$(document).ready(function () {
    $('#myModal').modal('show')
    $('#mailbutton').click(function (event) {
        window.location = "mailto:h.marzouk@uni-muenster.de";
    });
});


var map = L.map('map', {
    zoom: 8,
    minZoom: 7,      // (optional) prevents zooming in beyond level 19
    center: L.latLng([66, 28.2]),
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

function createMTLayer(data, color, layerName) {
    return L.geoJson(data, {
        pointToLayer: function (feature, latlng) {
            return L.circleMarker(latlng, {
                radius: 6,
                fillColor: color,
                color: '#000',
                weight: 1,
                opacity: 1,
                fillOpacity: 0.8
            });
        },
        onEachFeature: function (feature, layer) {
            if (feature.properties && feature.properties.name) {
                layer.bindPopup(`<b>Name:</b> ${feature.properties.name}`);
            }
        }
    });
}

// Example: these should be your actual GeoJSON data objects
// var mt_a = {...}, mt_b = {...}, mt_c = {...};

// Create individual layers
var mtLayerA = createMTLayer(mt_a, 'red', 'MT_A');
var mtLayerB = createMTLayer(mt_b, 'blue', 'MT_B');
var mtLayerC = createMTLayer(mt_c, 'green', 'MT_C');

// Add them to map (optional by default)
mtLayerA.addTo(map);
mtLayerB.addTo(map);
mtLayerC.addTo(map);
// 🔐 Replace with your actual API key

const apiKey = "11a96647-88c0-4011-841a-e09ff597d4f3";

const kiinteistotunnuksetLayer = L.tileLayer(
    `https://avoin-karttakuva.maanmittauslaitos.fi/avoin/wmts/1.0.0/kiinteistotunnukset/default/WGS84_Pseudo-Mercator/{z}/{y}/{x}.png?api-key=${apiKey}`,
    {
        tileSize: 256,
        minZoom: 12,
        // maxZoom: 18,
        attribution: '&copy; <a href="https://www.maanmittauslaitos.fi">Maanmittauslaitos</a>',
        opacity: 0.7
    }
);

const kiinteistojaotusLayer = L.tileLayer(
    `https://avoin-karttakuva.maanmittauslaitos.fi/avoin/wmts/1.0.0/kiinteistojaotus/default/WGS84_Pseudo-Mercator/{z}/{y}/{x}.png?api-key=${apiKey}`,
    {
        tileSize: 256,
        minZoom: 12,
        // maxZoom: 18,
        attribution: '&copy; <a href="https://www.maanmittauslaitos.fi">Maanmittauslaitos</a>',
        opacity: 0.7
    }
);


// Add to map (hide at start)
// kiinteistojaotusLayer.addTo(map);
// kiinteistotunnuksetLayer.addTo(map);



var overlayMaps = {
    "MT A (Red)": mtLayerA,
    "MT B (Blue)": mtLayerB,
    "MT C (Green)": mtLayerC,
    "Cadastre boundary": kiinteistojaotusLayer,
    "Cadastre codes": kiinteistotunnuksetLayer,
};

L.control.layers(null, overlayMaps, {
    collapsed: false, // Set to true if you want it collapsible
    position: 'topright'
}).addTo(map);
