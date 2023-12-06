require([

    //   "esri/config",
      "esri/Map",
      "esri/views/MapView",
      "esri/widgets/Sketch",
      "esri/layers/GraphicsLayer",
      "esri/layers/FeatureLayer",
      "esri/Graphic",
      "esri/geometry/geometryEngine",
      "esri/widgets/FeatureTable",
      "esri/widgets/Legend",
      "esri/widgets/Home",
      "esri/widgets/Expand",
      "esri/widgets/Zoom",
      "esri/widgets/Search",

    // ], function(Map, MapView, Sketch, GraphicsLayer, FeatureLayer, Graphic, geometryEngine, FeatureTable) {
    ], function(Map, MapView, Sketch, GraphicsLayer, FeatureLayer, Graphic, geometryEngine, FeatureTable, Legend, Home, Expand, Zoom, Search) {
    // ], function(esriConfig, Map, MapView, Sketch, GraphicsLayer, FeatureLayer) {

    //   esriConfig.apiKey = "AAPKca1f45d956a14bdfbd8ad8a0186ae048IvxPIJeyEVNq7JGkJZw0Ey0VNHFNeL6ucTIHLCS9oDIxxLUwVAZEyAfLTohkzpOi";

        const popupTemplate = {
            title: "Parcel {TAXID_LABE}",
            content: "Site Address: {SITEADDR} <br> Acreage: {CALC_ACREA}"
        };

        const parcelLayer = new FeatureLayer({ // authoritative layer
            url: "https://intervector.leoncountyfl.gov/intervector/rest/services/MapServices/TLC_OverlayParnal_D_WM/MapServer/0",
            popupTemplate: popupTemplate,
        });
        // const parcelLayer = new FeatureLayer({ // city only (my test layer)
        //     url: "https://services.arcgis.com/ptvDyBs1KkcwzQNJ/arcgis/rest/services/PropertyParcel_CityOnly_112823/FeatureServer",
        //     popupTemplate: popupTemplate,
        // });

        const heightLayer = new FeatureLayer({
            url: "https://services.arcgis.com/ptvDyBs1KkcwzQNJ/arcgis/rest/services/zoning_heights_MultipartToSi/FeatureServer",
            visible: false,
            title: "Allowed Heights"
            // visible: false
        });

        //////////////////////////
        //  CREATE MAP & VIEW  //
        /////////////////////////
        let selectionIdCount = 0; // The filtered selection id count
        let candidate; // The graphic accessed via the view.click event

        const map = new Map({
            basemap: "streets-relief-vector",
            // basemap: "gray-vector",
            // basemap: "arcgis/topographic" // basemap styles service
            layers: [parcelLayer, heightLayer]
        });
        
        const view = new MapView({
            container: "viewDiv",
            map: map,
            center: [-84.275, 30.45], //Longitude, latitude
            zoom: 15
        });
        
        
        /////////////////////////
        //  ADD SKETCH WIDGET  //
        /////////////////////////
        const graphicsLayerSketch = new GraphicsLayer();
        map.add(graphicsLayerSketch);

        const sketch = new Sketch({
            layer: graphicsLayerSketch,
            view: view,
            availableCreateTools: ["point"],
            creationMode: "update",
            defaultCreateOptions: "click",
            visibleElements: {
                selectionTools:{
                  "lasso-selection": false,
                  "rectangle-selection": false
                },
                settingsMenu: false,
                undoRedoMenu: false,
              }
        });


        ////////////////////////////////////////////////////////
        //  ADD SKETCH EVENTS TO LISTEN FOR AND EXECUTE QUERY //
        ////////////////////////////////////////////////////////
        sketch.on("update", (event) => {

            // Create
            if (event.state === "start") {
                queryParcelLayer(event.graphics[0].geometry);
            }
            if (event.state === "complete"){
                graphicsLayerSketch.remove(event.graphics[0]); // Clear the graphic when a user clicks off of it or sketches new one
            }

            // Change
            if (event.toolEventInfo && (event.toolEventInfo.type === "scale-stop" || event.toolEventInfo.type === "reshape-stop" || 
            event.toolEventInfo.type === "move-stop")) {
                queryParcelLayer(event.graphics[0].geometry);
            }
        });

        
        //*************************
        //   CREATE BUFFER LAYER
        //*************************
        // create layer to hold 1 mile buffer around selected parcel
        const bufferLayer = new GraphicsLayer();
        map.add(bufferLayer)

        const bufferSym = {
            type: "simple-fill", // autocasts as new SimpleFillSymbol()
            color: [240, 140, 222, 0.5],
            outline: {
              color: [0, 0, 0, 0.5],
              width: 2
            }
          };

          
        //***************************
        //   CREATE OTHER WIDGETS
        //***************************
        const table1Div = document.getElementById("table1Div");
        const table2Div = document.getElementById("table2Div");
        const titleDiv = document.getElementById("titleDiv");
        const parcelInfoDiv = document.getElementById("parcelInfoDiv");
        const dateDiv = document.getElementById("dateDiv");
        const searchWidget = new Search({view: view});
        const zoom = new Zoom({view: view});
        const home = new Home({view: view});
        const legend = new Legend({view: view});

        // put the legend in an expand widget so it is hidden by default
        const legendExpand = new Expand({
            expandIconClass: "esri-icon-legend",
            expandTooltip: "Legend",
            view: view,
            content: legend
        });

        
        //***********************************
        //   ADD WIDGETS TO USER INTERFACE  
        //***********************************
        view.ui.empty("top-left");
        view.ui.add(table1Div, "manual");
        view.ui.add(table2Div, "manual");
        view.ui.add(titleDiv, "top-left");
        view.ui.add(parcelInfoDiv, "top-left");
        view.ui.add(zoom, "bottom-left");
        view.ui.add(home, "bottom-left");
        view.ui.add(searchWidget, "bottom-left",);
        view.ui.add(legendExpand, "bottom-right");
        view.ui.add(dateDiv, "bottom-right");
        view.ui.add(sketch, "top-right");
        


        //************************************************************************
        //                               FUNCTIONS  
        //************************************************************************


        //***********************************
        function queryParcelLayer(geometry) {
            
            const parcelQuery = {
                spatialRelationship: "intersects", // Relationship operation to apply
                geometry: geometry,  // The sketch feature geometry
                outFields: ["TAXID_LABE","SITEADDR","CALC_ACREA"], // Attributes to return
                returnGeometry: true
            };
            
            parcelLayer.queryFeatures(parcelQuery)
            .then((results) => {
                
                // console.log("Feature count: " + results.features.length)
                
                displayParcelResults(results);
                
            }).catch((error) => {
                console.log(error);
            });
            
        }
        
        
        //***********************************
        function displayParcelResults(results) {
            
            // Create a blue polygon
            const symbol = {
                type: "simple-fill",
                color: [ 20, 130, 200, 0.5 ],
                outline: {
                    color: "white",
                    width: .5
                },
            };
            
            // Set symbol (other feature properties can also be set here)
            results.features.map((feature) => {
                feature.symbol = symbol;
                feature.popupTemplate = popupTemplate
                return feature;
            });
            
            // update the parcelInfoDiv with the address & taxID of the selected parcel & make it visible
            const parcelAddress = results.features[0].attributes.SITEADDR
            const parcelID = results.features[0].attributes.TAXID_LABE        
            parcelInfoDiv.innerHTML = `<b>Showing Results for:</b> ${parcelAddress} (Tax ID: ${parcelID})`
            parcelInfoDiv.style.display = "inline"
            
            
            // create the buffer around the parcel
            bufferParcel(results.features[0].geometry);
            
            // Clear display
            // view.closePopup();
            view.graphics.removeAll();
            
            // Add features to graphics layer
            view.graphics.addMany(results.features);
            
        }
        
        
        //***********************************
        function bufferParcel(results) {
            
            // calculate the 1 mile buffer & recenter the map on it 
            const buffer = geometryEngine.geodesicBuffer(results, 1, "miles");
            const lon = buffer.centroid.longitude
            const lat = buffer.centroid.latitude
            view.center = [lon, lat];
            view.zoom = 15
            
            // create or update the buffer circle graphic
            if(bufferLayer.graphics.length === 0){ //if it doesn't exist, create it
                bufferLayer.add(
                    new Graphic({
                        geometry: buffer,
                        symbol: bufferSym
                    })
                    );
                } else { //if it already exists, update the geometry attribute
                    const graphic = bufferLayer.graphics.getItemAt(0);
                    graphic.geometry = buffer;
                }
                
                // find the zoning districts that intersect with the buffer
                queryHeightLayer(buffer)
                
            } // END BufferParcel()
            
            

            //***********************************
            function queryHeightLayer(buffer) {
                
                const heightQuery = {
                    spatialRelationship: "intersects", // Relationship operation to apply
                    geometry: buffer,  
                    outFields: ["OBJECTID","ZONED", "ZONING", "Height_Name", "Height_Stories", "Height_Feet"], // Attributes to return
                    returnGeometry: true
                };
                
                heightLayer.queryFeatures(heightQuery)
                .then((results) => {
                    
                    // console.log("Feature count: " + results.features.length)
                    
                    displayHeightResults(results);
                    
                }).catch((error) => {
                    console.log(error);
                });
                
            } // END QueryHeightLayer
            
            

            //***********************************
            let initialMapLayersLength = map.layers.length //global variable needed in function
            function displayHeightResults(results) {
                
                // Create polygon symbols
                const symbol = {
                    type: "simple-fill",
                    color: [ 120, 130, 200, 0.5 ],
                    outline: {
                        color: "white",
                        width: .5
                    },
                };
    
                // TODO TEST ****************** // Shouldn't need this anymore because it was for the graphic & we converted the graphic result into a layer
                // Set symbol and popup 
                results.features.map((feature) => {
                feature.symbol = symbol;
                return feature;
                });              

                // If the "Zoning Heights" layer (the one with the subset that intersects the 1 mile buffer)
                // already exists, remove it. This will make the old subset disappear when the user clicks a new parcel.                 
                if (map.layers.length > initialMapLayersLength) {
                    let zoningHeightLyrIndex = map.layers.findIndex(function(layer){
                        return layer.title === "Allowed Heights";
                    });
                    let heightSubsetLyr = map.layers.at(zoningHeightLyrIndex);
                    map.layers.remove(heightSubsetLyr);
                }
                            
                // KEEP - this is a test set up during development to ensure the above code to remove the layer is working;
                // keeping it in case adjustments to the layers are needed in the future 
                // let layerList2 = []
                // for (i=0; i<map.layers.length; i++) {
                //     layerList2.push(map.layers.items[i].title)}             
                // console.log("layerList2:")
                // console.log(layerList2)


                // create the new height layer from the query of which zoning districts intersect the 1 mile buffer
                let resultsHeightLayer = new FeatureLayer({
                    source: results.features,
                    objectIdField: "OBJECTID",
                    geometryType: "polygon",
                    spatialReference: {
                        wkid: 3857
                    },
                    renderer: {
                        type: "simple",
                        symbol:{
                            type: "simple-fill",
                            color: [ 120, 130, 200, 0.5 ],
                            outline: {
                            color: "white",
                            width: .5
                            }
                        }                        
                    },
                    /// TEST - may not need these since they are defined in the new layer, but verify they aren't needed to pass data along.
                    fields: [{  
                      name: "OBJECTID",
                    //   alias: "ObjectID",
                      type: "oid"
                    }, {
                      name: "Height_Stories",
                    //   alias: "Stories",
                      type: "integer"
                    }, {
                        name: "Height_Feet",
                        // alias: "Feet",
                        type: "integer"
                    }, {
                        name: "Height_Name",
                        // alias: "Name",
                        type: "string"
                    }],
                  });

                map.add(resultsHeightLayer)

                makeFeatureTables(resultsHeightLayer)

            } // END displayHeightResults()

            
            
            //***********************************
            let featureTable, featureTable2 //global variables needed in function
            function makeFeatureTables(resultsHeightLayer){

                const featureLayer = resultsHeightLayer
                featureLayer.title = "Allowed Heights";
                

                // **********************************
                //   CREATE FEATURE TABLE 1 (Feet) 
                // **********************************
                // create the table if this is a new query & update layer data if it is a repeat query
                if (featureTable === undefined) { //the Feature Table doesn't yet exist
                    // Create the feature table
                    featureTable = new FeatureTable({
                        layer: featureLayer,
                        container: table1Div,
                        view: view, // Required for feature highlight to work
                        multiSortEnabled: true,
                        visibleElements: {
                            header: false
                        },
                        tableTemplate: {
                            columnTemplates: [
                                {
                                    type: "field",
                                    fieldName: "Height_Name",
                                    label: "District Name",
                                    direction: "asc",
                                    initialSortPriority: 1  
                                },
                                {
                                    type: "field",
                                    fieldName: "Height_feet",
                                    label: "Feet",
                                    direction: "desc",
                                    initialSortPriority: 0 
                                },
                            ]
                        },
                    });
                    
                }                
                else { // the Feature Table already exists
                    // redefine the layer property to use the newest set of queried zoning district features
                    featureTable.layer = featureLayer
                } // end 
                

                // *************************************
                //   CREATE FEATURE TABLE 2 (Stories)
                // *************************************
                if (featureTable2 === undefined) { //the Feature Table doesn't yet exist
                    // Create the feature table
                    featureTable2 = new FeatureTable({
                        view: view,
                        layer: featureLayer,
                        container: table2Div,
                        multiSortEnabled: true,
                        visibleElements: {
                            header: false
                        },
                        tableTemplate: {
                            columnTemplates: [
                                {
                                type: "field",
                                fieldName: "Height_Name",
                                label: "District Name",
                                direction: "asc",  //have to specify this to use initialSortPriority
                                initialSortPriority: 1  //sort by this column second 
                                },
                                {
                                type: "field",
                                fieldName: "Height_Stories",
                                label: "Stories", 
                                direction: "desc",  //have to specify this to use initialSortPriority
                                initialSortPriority: 0  //sort by this column second 
                                },
                            ]
                        },
                    });
                }
                else { // the Feature Table already exists
                    // redefine the layer property to use the newest set of queried zoning district features
                    featureTable2.layer = featureLayer
                }    

                table1Div.style.display = "flex"
                table2Div.style.display = "flex"
                
            } // END makeFeatureTables

}); // END main function