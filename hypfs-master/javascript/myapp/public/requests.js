///browserify requests.js -o bundle.js 
var OpenLocationCode = require('open-location-code').OpenLocationCode
function client_request(url, data, operation) {

    $.ajax({
        type: 'POST',
        url: url,
        contentType: 'application/json',
        data: data,
        success: function (data) {
            output_data(operation, data)

        },
        error: function (err) {
            console.log("errore", err)
        }
    });

}

global.choose_operation = function (operation) {
    var url;
    var data;

    switch (operation) {
        case "insert":

            url = '/insert'
            //data = JSON.stringify({ 'keyword': 3, "obj": point })

            break;
        case "pin_search":


            url = '/pin_search'
            data = JSON.stringify({ 'keyword': '8FXX4275+WC', "threshold": -1 })

            break;
        case "superset_search":

            url = '/superset_search'
            data = JSON.stringify({ 'keyword': '8FXX4275+WC', "threshold": 5 })
            break;

        case "remove":

            url = '/remove'
            data = JSON.stringify({ 'keyword': '8FXX4275+WC', "obj": "JTXBOI9PSLJQUQOEJHULRVHBFDOEFTGXZQZAGS9ZSUGXJTJFFKPN9PIQGWONMJXMIRAKLWIW9YSFICUU9" })
            break;

    }
    client_request(url, data, operation)

}


global.output_data = function (operation, data) {
    console.log(data)


    switch (operation) {
        case "pin_search":
        case "superset_search":

            var messages = []
            for (i = 0; i < data.length; i++) {
                for (j = 0; j < data[i].length; j++) {
                    console.log(data[i][j])
                    messages.push(data[i][j])
                }
            }

            for (element of messages) {
                //console.log(element)

                coord = decodeOLC(element.message)
                L.marker([coord.latitudeCenter, coord.longitudeCenter]).addTo(layerGroup);
                //marker.bindPopup("<b>Hello world!</b><br>I am a popup.").openPopup();
            }

            break;

        case "clear":
            // remove all the markers in one go
            layerGroup.clearLayers();
            break;
        default:
            break;

    }
}

function decodeOLC(code) {

    const openLocationCode = new OpenLocationCode();
    const coord = openLocationCode.decode(code)
    return coord

}
