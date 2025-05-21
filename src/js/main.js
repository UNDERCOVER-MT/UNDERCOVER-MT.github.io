$(document).ready(function () {
    // $('#myModal').modal('show')
    // $('#mailbutton').click(function (event) {
    //     window.location = "mailto:h.marzouk@uni-muenster.de";
    // });
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
L.control.locate().addTo(map);

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
map.on("bfl:filesizelimit", function () { notification.alert('Error', 'Maximun file size allowed is 60 MB'); })


var routingControl = null;


L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

var layers = [];
for (var providerId in providers) {
    layers.push(providers[providerId]);
}

//  Add navigation
map.on('popupopen', function (e) {
    const link = e.popup._contentNode.querySelector('.navigate-link');
    if (link) {
        link.addEventListener('click', function (event) {
            event.preventDefault();

            const lat = parseFloat(this.dataset.lat);
            const lng = parseFloat(this.dataset.lng);
            const destination = L.latLng(lat, lng);

            if (routingControl !== null) {
                map.removeControl(routingControl);
            }

            navigator.geolocation.getCurrentPosition(function (pos) {
                const userLatLng = L.latLng(pos.coords.latitude, pos.coords.longitude);

                routingControl = L.Routing.control({
                    waypoints: [
                        userLatLng,
                        destination
                    ],
                    routeWhileDragging: false,
                    show: false,
                    addWaypoints: false,
                    lineOptions: {
                        styles: [
                            {
                                color: '#0077ff',      // route color
                                weight: 4,             // line thickness
                                opacity: 0.8,
                                dashArray: '8, 8'      // ✅ dashed line: 8px dash, 8px gap
                            }
                        ]
                    },
                    createMarker: () => null  // optional: no default markers
                }).addTo(map);

            }, function (err) {
                alert("Geolocation failed: " + err.message);
            });
        });
    }
});


var ctrl = L.control.iconLayers(layers).addTo(map);

let mtCTooltips = []; // Store tooltips for zoom toggle
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
            let popupContent = "";
            const name = feature.properties.name || "";

            // ✅ Match note from stationNotes by checking if any key is in name
            let matchedNote = null;
            // console.log("Feature name:", feature.properties.name);
            // console.log("Station notes keys:", Object.keys(stationNotes));
            for (const code in stationNotes) {
                // console.log(stationNotes)
                if (name.includes(code)) {
                    matchedNote = stationNotes[code];
                    break;
                }
            }

            // Build popup
            if (name) {
                popupContent += `<b>Name:</b> ${name}<br>`;
            }
            if (matchedNote) {

                popupContent += `<b>Note:</b> ${matchedNote}<br>`;
            }
            popupContent += `<hr style="margin: 4px 0; border-top: 3px solid #aaa;">`;  // clean divider
            popupContent += `<a href="#" class="navigate-link" data-lat="${layer.getLatLng().lat}" data-lng="${layer.getLatLng().lng}">📍 Navigate here</a>`;

            layer.bindPopup(popupContent);

            // ✅ Add label only to MT_C
            if (layerName === 'MT_C' && name) {
                const tooltip = L.tooltip({
                    permanent: true,
                    direction: 'top',
                    className: 'mt-label'
                })
                    .setContent(name)
                    .setLatLng(layer.getLatLng())
                    .addTo(map);

                mtCTooltips.push(tooltip);
            }
        }
    });
}

//    // 🟩 Add permanent labels only for MT_C
//         if (layerName === 'MT_C' && feature.properties.name) {
//             layer.bindTooltip(feature.properties.name, {
//                 permanent: true,
//                 direction: 'top',
//                 className: 'mt-label'
//             });
//         }
//     }
L.easyButton({
    states: [{
        stateName: 'clearRoute',
        icon: 'fa-times-circle', // Font Awesome icon
        title: 'Clear Route',
        onClick: function (btn, map) {
            if (routingControl !== null) {
                map.removeControl(routingControl);
                routingControl = null;
            }
        }
    }]
}).addTo(map);

// Example: these should be your actual GeoJSON data objects
// var mt_a = {...}, mt_b = {...}, mt_c = {...};

// Create individual layers
var mtLayerA = createMTLayer(mt_a, 'red', 'MT_A');
var mtLayerB = createMTLayer(mt_b, 'blue', 'MT_B');
var mtLayerC = createMTLayer(mt_c, 'green', 'MT_C');


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

const majorLayer = L.geoJSON(major_powerline, {
    style: {
        color: 'red',
        weight: 3
    },
    onEachFeature: function (feature, layer) {
        layer.bindPopup(`Name: ${feature.properties.name}<br>Voltage: ${feature.properties.voltage} V`);
    }
})

const minorLayer = L.geoJSON(minor_powerline, {
    style: {
        color: 'blue',
        weight: 2,
        // dashArray: '5, 5'
    },
    onEachFeature: function (feature, layer) {
        layer.bindPopup(`Name: ${feature.properties.name}<br>Voltage: ${feature.properties.voltage} V`);
    }
})


// Assuming your data is in a variable named `geology`
// Step 1: Create a color palette based on unique rock names
const colorMap = {};
const colorList = [
    '#bcf60c', '#e6beff', '#ffe119', '#4363d8', '#f58231',
    '#911eb4', '#46f0f0', '#f032e6', '#e6194b', '#fabebe',
    '#008080', '#3cb44b', '#9a6324', '#fffac8', '#800000'
];
let colorIndex = 0;

map.createPane('geologyPane');
map.getPane('geologyPane').style.zIndex = 200;  // lower than default overlay zIndex
// Step 2: Create the GeoJSON layer
const geologyLayer = L.geoJSON(geology, {
    pane: 'geologyPane',  // 🔽 use your custom pane

    style: function (feature) {
        const rock = feature.properties.ROCK_NAME || "Unknown";
        if (!colorMap[rock]) {
            colorMap[rock] = colorList[colorIndex % colorList.length];
            colorIndex++;
        }
        return {
            color: colorMap[rock],
            weight: 1,
            fillOpacity: 0.5
        };
    },
    onEachFeature: function (feature, layer) {
        const p = feature.properties;
        const popupContent = `
        <table style="width:100%; font-size: 13px;">
            <tr><th>OBJECTID</th><td>${p.OBJECTID || "-"}</td></tr>
            <tr><th>Eon</th><td>${p.EON_ || "-"}</td></tr>
            <tr><th>Era</th><td>${p.ERA_ || "-"}</td></tr>
            <tr><th>Chronostrat. Unit</th><td>${p.CHRONOSTRATICRAPHIC_UNIT_ || "-"}</td></tr>
            <tr><th>Epoch</th><td>${p.EPOCH_ || "-"}</td></tr>
            <tr><th>Group</th><td>${p.GROUP__ || "-"}</td></tr>
            <tr><th>Formation</th><td>${p.FORMATION_ || "-"}</td></tr>
            <tr><th>Member</th><td>${p.MEMBER_ || "-"}</td></tr>
            <tr><th>Original Name</th><td>${p.ORIGINAL_NAME || "-"}</td></tr>
            <tr><th>Rock Class</th><td>${p.ROCK_CLASS_ || "-"}</td></tr>
            <tr><th>Rock Name</th><td>${p.ROCK_NAME_ || "-"}</td></tr>
        </table>
    `;
        layer.bindPopup(popupContent);
    }

})


const faultLayer = L.geoJSON(fault, {
    style: function () {
        return {
            color: 'black',
            weight: 1.5,
            opacity: 0.8
        };
    },
    onEachFeature: function (feature, layer) {
        const p = feature.properties;
        let tableRows = "";

        // Loop through all properties ending in "_"
        for (const key in p) {
            if (p.hasOwnProperty(key) && key.endsWith("_")) {
                tableRows += `
                    <tr>
                        <th style="text-align:left; padding: 4px; background-color:#f8f8f8;">${key}</th>
                        <td style="padding: 4px;">${p[key] !== -9999 && p[key] !== "" ? p[key] : "-"}</td>
                    </tr>
                `;
            }
        }

        const popupContent = `
            <div style="font-family: sans-serif; font-size: 13px;">
                <table style="width:100%; border-collapse: collapse; border: 1px solid #ccc;">
                    ${tableRows}
                </table>
            </div>
        `;
        layer.bindPopup(popupContent);
    }
})


var baseLayers = []; // (optional)

var groupedOverlays = [
    {
        group: "Magnetotelluric",
        layers: [
            { name: "MT A (Red)", layer: mtLayerA },
            { name: "MT B (Blue)", layer: mtLayerB },
            { name: "MT C (Green)", layer: mtLayerC }
        ]
    },
    {
        group: "Cadastre",
        layers: [
            { name: "Cadastre boundary", layer: kiinteistojaotusLayer },
            { name: "Cadastre codes", layer: kiinteistotunnuksetLayer }
        ]
    },
    {
        group: "Infrastructure",
        layers: [
            { name: "Major powerline", layer: majorLayer },
            { name: "Minor powerline", layer: minorLayer }
        ]
    },
    {
        group: "Geology",
        layers: [
            { name: "Geology", layer: geologyLayer },
            { name: "Faults", layer: faultLayer }
        ]
    }
];

// Add them to map (optional by default)
mtLayerA.addTo(map);
mtLayerB.addTo(map);
mtLayerC.addTo(map);

// var overlayMaps = {
//     "MT A (Red)": mtLayerA,
//     "MT B (Blue)": mtLayerB,
//     "MT C (Green)": mtLayerC,
//     "Cadastre boundary": kiinteistojaotusLayer,
//     "Cadastre codes": kiinteistotunnuksetLayer,
//     "Major powerline": majorLayer,
//     "Minor powerline": minorLayer,
//     "Geology": geologyLayer,
//     "Faults": faultLayer
// };

// L.control.layers(null, overlayMaps, {
//     collapsed: false, // Set to true if you want it collapsible
//     position: 'topright'
// }).addTo(map);
L.control.panelLayers(baseLayers, groupedOverlays, {
    compact: true, // true = collapsed groups by default
    collapsibleGroups: true,
    position: 'topright'
}).addTo(map);
