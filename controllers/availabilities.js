const express = require('express');

const moment = require('moment');

module.exports = (timeSlots) => {
    const availabilities = express.Router();
    
    availabilities.get('/', (req, res) => {
        var spec = req.query.spec;
        var date = (new Date(req.query.date)).getTime();
        timeSlots.getAvailableTimes(spec,date)
        .then(data => timeSlots.getFreeSlots(data))
        .then(week => { // Filter past availabilities out
            var temp = week.map(day => {
                var output = {};
                output.date = day.date;
                var outputSlots = [];
                var formattedTime = moment().subtract(4, 'hours').format();
                day.slots.forEach(slot => {
                    var formattedSlotDate = moment(output.date).format('YYYY-MM-DD');
                    var formattedSlotTime = slot.start;
                    var slotTime = `${formattedSlotDate}T${formattedSlotTime}Z`;
                    if (slotTime >= formattedTime) {
                        outputSlots.push(slot);
                    }
                    
                    output.slots = outputSlots;
                });
                
                output.slots = outputSlots;
                return output;
            });
            return temp;
        })
        .then(data=>{// Formatting output data for front-end
            var output1 = data.map(day=>{
                var output2 = {
                    date: day.date,
                    slots: day.slots.map(slot=>{
                        return {
                            start: slot.start,
                            end: slot.end
                        };                        
                    })
                }
                return output2;
            })
            return res.json(output1)
        })
        .catch(console.error);
    })

    return availabilities;
};