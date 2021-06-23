var express = require('express');
var router = express.Router();
const request = require('request');
const myModuleFetch = require('../IOTA_services/fetch-data');
const utils = require('../utils.js')


router.post('/superset_search_test', async function (req, res) {


    point = utils.OPC_conversion_manual(req.body.point)
    threshold = req.body.threshold
 
    const encoded_point = utils.binToStr(utils.encode(point))
    console.log("POINT:", point, "-->", "ENCODED POINT:", encoded_point)

    make_req(encoded_point, threshold, async function (data) {

        if (data != undefined) {

            roots = utils.split_str(data)
            //console.log("Roots da DHT", roots, "point:", req.body.point)
            var resultFetch = []
            //get data from MAM
            console.log('Fetch data from the tangle. Please be patient...')

            for (const root of roots) {

                await myModuleFetch.fetchData(root).then(function (res) {
                    resultFetch.push(res)

                })
            }
            console.log('Fetch DONE.')
            res.send({'data':resultFetch, "point":req.body.point})
        } else {
            console.log("No result found")
            res.send("No result found")
        }
    })
});



const make_req = async function (keyword, threshold, callback) {

    const options = {
        url: 'http://127.0.0.1:50001/superset_search',
        method: 'GET',
        qs: { 'keyword': keyword, "threshold": threshold, 'sender': 'user' },
        json: true
    };

    request(options, function optionalCallback(err, httpResponse, body) {
        console.log("REQUEST SUPERSET SEARCH DHT DONE.")
        if (err) {
            console.error('Upload failed:', err);
        } else {

            if (body == "") {
                callback("")
            } else {
                callback(body)
            }
        }

    })
}

module.exports = router;