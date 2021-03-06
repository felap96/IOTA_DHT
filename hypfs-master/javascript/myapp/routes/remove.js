var express = require('express');
var router = express.Router();
const request = require('request');
utils = require("../utils")

router.post('/remove', async function (req, res) {

    point = req.body.keyword
    message_id = req.body.obj
    const encoded_point = utils.binToStr(utils.encode(point))

    console.log(encoded_point, message_id)

    const options = {
        url: 'http://127.0.0.1:50001/remove',
        method: 'GET',
        qs: { 'keyword': encoded_point, "obj": message_id },
        json: true
    };

    make_req(options, function (data) {
        res.send({operation: "remove", point:  point, data: data})
    })

})

async function make_req(options, callback) {

    request(options, function optionalCallback(err, httpResponse, body) {

        if (err) {
            return console.error('upload failed:', err);
        }
        console.log('Server responded with:', body);

        callback(body)
    })
}

module.exports = router;