$(document).ready(function () {
    $('#myModal').modal('show')
    $('#mailbutton').click(function (event) {
        window.location = "mailto:h.marzouk@uni-muenster.de";
    });
});


var map = L.map('map', {
    zoom: 7,
    center: L.latLng([65.6, 28.2]),
    attributionControl: true,
    fullscreenControl: true,
    fullscreenControlOptions: {
        position: 'topleft',
    },
});

map.attributionControl.setPrefix('<a href="https://leafletjs.com" title="A JavaScript library for interactive maps">Leaflet ' + L.version + '</a>');

map.addControl(new L.Control.LinearMeasurement({
    unitSystem: 'metric',
    color: '#FF0080',
    type: 'line'
}));

// var hash = new L.Hash(map);

var notification = L.control
    .notifications({
        className: 'pastel',
        timeout: 5000,
        position: 'topleft',
        closable: true,
        dismissable: true,
    })
    .addTo(map);

L.Control.geocoder({ position: "topleft", showResultIcons: true }).addTo(map);

L.Control.betterFileLayer({
    fileSizeLimit: 60240, // File size limit in kb (10 MB)),
    text: { // If you need translate
        title: "Import a file (Max 60 MB)", // Plugin Button Text
    },
}).addTo(map);


L.control.scale(
    {
        imperial: false,
    }).addTo(map);


L.easyButton({
    states: [{
        stateName: 'openInfo',        // name the state
        icon: 'fa-question',               // and define its properties
        title: 'Information',      // like its title
        onClick: function (btn, map) {       // and its callback
            $('#myModal').modal('show')
        }
    }]
}).addTo(map)


// var browserControl = L.control.browserPrint({ position: 'topleft', title: 'Print Map' }).addTo(map);

L.geoJson(finalndBoundary, {
    // Add invert: true to invert the geometries in the GeoJSON file
    invert: true,
    renderer: L.svg({ padding: 1 }),
    color: 'gray', fillOpacity: 0.7, weight: 0
}).addTo(map);




map.on("bfl:layerloaded", function () { notification.success('Success', 'Data loaded successfully'); })
map.on("bfl:layerloaderror", function () { notification.alert('Error', 'Unable to load file'); })
map.on("bfl:filenotsupported", function () { notification.alert('Error', 'File type not supported'); })
map.on("bfl:layerisempty", function () { notification.warning('Error', 'No features in file'); })
map.on("bfl:filesizelimit", function () { notification.alert('Error', 'Maximun file size allowed is 50 MB'); })




L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

var layers = [];
for (var providerId in providers) {
    layers.push(providers[providerId]);
}


var ctrl = L.control.iconLayers(layers).addTo(map);


// var layer = L.dataClassification(HydroData, {
//     style: {
//         radius: 6, fillOpacity: 0.7,       // polygon fill opacity in polygon modes
//     },
//     mode: 'manual',
//     classes: [23, 26, 34, 37, 41, 42, 44, 47, 52, 61],
//     field: 'Temperature',
//     pointMode: 'color',
//     colorRamp: 'RdYlGn',
//     legendTitle: 'Temperature °C',
//     legendFooter: 'updated: April 2024',
//     legendPosition: 'topright',
//     reverseColorRamp: true,
//     classRounding: 1,
//     legendTemplate: {
//         highest: '{low} - 87',
//         middle: '{low} - {high}',
//         lowest: '{low} - {high}',
//         nodata: 'No data'
//     },
//     onEachFeature: (feature, layer) => {
//         if (feature.properties) {
//             const rows = Object.keys(feature.properties)
//                 .map((key) => {
//                     return `<span> <b>${key}</b> : ${feature.properties[key]} </span>`;
//                 });

//             layer.bindPopup(
//                 `
//                           <div style="display:flex;flex-direction:column;gap:5px                      "> 
//                               ${rows.join("")}
//                           </div>
//                         `,
//                 {
//                     minWidth: 200,
//                     maxHeight: 520,
//                 },
//             );
//         }
//     },

// },).addTo(map);

