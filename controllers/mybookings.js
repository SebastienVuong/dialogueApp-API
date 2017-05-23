const express = require('express');
const moment = require('moment');
const DialogueAvailabilitiesDataLoader = require('../lib/dialogue-availabilities.js');



module.exports = (bookingLoader) => {
    const mybookings = express.Router();
    
    // Endpoint to get all bookings
    mybookings.get('/', (req,res) => {
        var sub = req.user.sub;
        
        var rawOutputs;
        bookingLoader.getAllBookingsForPatient(sub)
        .then(bookings => {
            rawOutputs = bookings;
            return DialogueAvailabilitiesDataLoader.getAllUserData();
        })
        .then(data  => {
            // Get all reference arrays
            var professionals = DialogueAvailabilitiesDataLoader.getAllProfessionals(data);
            var specializations = DialogueAvailabilitiesDataLoader.getAllSpecializations(data);
            
            return rawOutputs.map(rawOutput => {
                // Use userId to find firstName, lastName and locationId in professionals
                professionals.forEach(professional=>{
                    if (professional.id == rawOutput.specialist) {
                        rawOutput.firstName = professional.firstName;
                        rawOutput.lastName = professional.lastName;
                        rawOutput.specId = professional.specId
                    }
                });
    
                // Use specId to find specialization in specializations
                specializations.forEach(spec=>{
                    if (spec.id == rawOutput.specId[0]) {
                        rawOutput.specialization = spec.spec;
                    }
                });
                
                // Format output 
                var formattedOutput = {
                    id: rawOutput.id,
                    firstName: rawOutput.firstName,
                    lastName: rawOutput.lastName,
                    time: rawOutput.startTime, // TO BE FORMATTED
                    specialization: rawOutput.specialization
                };
                
                // Return output
                return formattedOutput;
            });
        })
        .then(bookings => {
            return res.status(201).json(bookings);
        })
    })

    return mybookings;
};