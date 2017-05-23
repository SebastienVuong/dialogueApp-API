const express = require('express');
const moment = require('moment');
const Mailgun = require('mailgun-js');
const DialogueAvailabilitiesDataLoader = require('../lib/dialogue-availabilities.js');



module.exports = (bookingLoader, timeSlots) => {
    const bookings = express.Router();

    // Endpoint to create a booking
    bookings.post('/', (req,res) => {
        const api_key = process.env.MAILGUN_KEY;
        const domain = process.env.MAILGUN_DOMAIN;
        const from_who = process.env.MAILGUN_FROM;

        // Request data extraction
        var date = req.body.date; // 2000-04-13T00:00:00.000Z
        var time = req.body.startTime; // HH:mm
        var sub = req.user.sub;
        var spec = req.body.spec;
        var email = req.body.mail;
        var avatar = req.body.picture;

        // Format start time for booking
        var formattedStart = moment(date).format('YYYY-MM-DD') + " " + time + ":00";

        // Compute and format end time for booking
        var timeInputs = time.split(':');
        var endMinutes = parseInt(timeInputs[1])+20;
        var endHours;
        if (endMinutes == 60) {
            endMinutes = 0;
            endHours = parseInt(timeInputs[0])+1;
        } else {
            endHours = timeInputs[0];
        }
        var formattedEnd = moment(date).format('YYYY-MM-DD') + " " + endHours + ":" + endMinutes + ":00";
        
        // Preparing data for booking
        var bookingData = {
            sub: sub,
            startTime: formattedStart, 
            endTime: formattedEnd, 
            location: Math.ceil(10*Math.random()), // WE AREN'T USING THIS AS OF NOW
        };

        var rawOutput = {};

        // Compute userId
        timeSlots.getAvailableTimes(spec,(new Date(date)).getTime())
        .then(data=>timeSlots.getFreeSlots(data))
        .then(avails=>{
            var day = 0;
            avails.forEach((today,idx)=>{
                if (moment(today.date).format('YYYY-MM-DD') == moment(date).format('YYYY-MM-DD')) {
                    day = idx;
                }
            });
            avails[day].slots.forEach(slot=>{
                if (slot.start == time) {
                    bookingData.specialist = slot.specialists[0];
                }
            })
        })
        // Create booking
        .then(()=>{
            return bookingLoader.createBooking(bookingData)
        })    
        .then(booking => {
            rawOutput.id = booking[0].id;
            return DialogueAvailabilitiesDataLoader.getAllUserData()
        })
        .then(data => {
            // Get all reference arrays
            var professionals = DialogueAvailabilitiesDataLoader.getAllProfessionals(data);
            var specializations = DialogueAvailabilitiesDataLoader.getAllSpecializations(data);
            
          // Use userId to find firstName, lastName and locationId in professionals
            professionals.forEach(professional=>{
                if (professional.id == bookingData.specialist) {
                    rawOutput.firstName = professional.firstName;
                    rawOutput.lastName = professional.lastName;
                    rawOutput.specId = professional.specId
                }
            })

            // Use specId to find specialization in specializations
            specializations.forEach(spec=>{
                if (spec.id == rawOutput.specId[0]) {
                    rawOutput.specialization = spec.spec;
                }
            })

            // Format output
            var formattedOutput = {
                id: rawOutput.id,
                firstName: rawOutput.firstName,
                lastName: rawOutput.lastName,
                time: formattedStart,
                specialization: rawOutput.specialization,
                email: email,
                avatar: avatar
            };

            // Return output
            return formattedOutput;
        })
        .then(booking => {
            var mailgun = new Mailgun({apiKey: api_key, domain: domain});

            // Declare message parameters
            var data = {
                from: from_who,
                to: booking.email, // email to be computed
                subject: 'Your appointment confirmation for ' + booking.time,
                html: `
                <html><body style="margin: 0;"><table cellpadding="0" cellspacing="0" width="100%">
                    <tbody style="color: #0d4a68; font-family: Arial, sans-serif; font-size: 16px; line-height: 20px;">
                        <tr style="background-color: #26bdf0;">
                          <td>
                              <table>
                                  <tr>
                                      <td style="height: 37;">
                                          <img src="https://dialogue.co/wp-content/themes/dialogue/library/img/logo-white.png" width="150" height="35" style="display: block;">
                                      </td>
                                      <td style="width:100%;"></td>
                                      <td>
                                          <img src="${booking.avatar}" alt="avatar" style="border-radius: 50%; height: 50px; width: 50px;">
                                      </td>
                                  </tr>
                              </table>
                          <td>
                        </td>
                    </tr>
                        </tr>
                        <tr>
                            <td>
                                <table  cellpadding="0" cellspacing="0" width="90%" align="center" style="color: #0d4a68; font-family: Arial, sans-serif; font-size: 16px; line-height: 20px; margin: 0;">
                                    <tr>
                                        <td height="40"></td>
                                    </tr>
                                    <tr height="30">
                                        <td align="center">
                                            This email is to confirm your appointment on <b>${booking.time}</b>
                                        </td>
                                    </tr>
                                    <tr height="30">
                                        <td align="center">
                                            ${booking.specialization}: ${booking.firstName}, ${booking.lastName}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td height="40"></td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <td style="border-bottom: 1px solid #0d4a68; border-top: 1px solid #0d4a68; background-color: lightgray; height: 35px;">
                            <table  cellpadding="0" cellspacing="0" width="95%" align="center">
                                <tr>
                                    <td style="color: #0d4a68; font-family: Arial, sans-serif; font-size: 12px; line-height: 20px;">
                                    Booking link: ${process.env.APP_DOMAIN}/bookings/${booking.id}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tbody>
                </table></body></html>
                ` // Booking link to be changed when hosted online
            }

            mailgun.messages().send(data, function (error, body) {
                console.log(body);
            })
            return booking;
        })
        .then(booking => {
            return res.status(201).json(booking);
        })
        .catch(console.error);
    })
    
    // Endpoint to view a booking
    bookings.get('/:id', (req,res) => {
        var rawOutput = {}

        // Retrieve booking
        bookingLoader.getBooking({
            id: req.params.id,
            sub: req.user.sub
        })
        .then(output=>{
            // if (output.length==0) {
                rawOutput = {
                id: output[0].id,
                timeSlot: output[0].startTime,
                specialist: output[0].specialist
                };

            return DialogueAvailabilitiesDataLoader.getAllUserData()
        })
        .then(data=>{
            // Get all reference arrays
            var professionals = DialogueAvailabilitiesDataLoader.getAllProfessionals(data);
            var specializations = DialogueAvailabilitiesDataLoader.getAllSpecializations(data);

            // Use userId to find firstName, lastName and locationId in professionals
            professionals.forEach(professional=>{
                if (professional.id == rawOutput.specialist) {
                    rawOutput.firstName = professional.firstName;
                    rawOutput.lastName = professional.lastName;
                    rawOutput.specId = professional.specId
                }
            })

            // Use specId to find specialization in specializations
            specializations.forEach(spec=>{
                if (/*validBooking && */spec.id == rawOutput.specId[0]) {
                    rawOutput.specialization = spec.spec;
                }
            })

            // Format output
            var formattedOutput = {
                id: rawOutput.id,
                firstName: rawOutput.firstName,
                lastName: rawOutput.lastName,
                time: rawOutput.timeSlot,
                specialization: rawOutput.specialization
            };

            // Return output
            return res.json(formattedOutput);
        })
        .catch(err => res.status(403).json(err))
    }) 
    return bookings;
};

