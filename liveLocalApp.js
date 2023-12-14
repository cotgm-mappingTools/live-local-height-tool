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
      "esri/widgets/ScaleBar",

    ], function(Map, MapView, Sketch, GraphicsLayer, FeatureLayer, Graphic, geometryEngine, FeatureTable, Legend, Home, Expand, Zoom, Search, ScaleBar) {

        // need to enable "esri/config" if this is used        
        // esriConfig.apiKey = "AAPKca1f45d956a14bdfbd8ad8a0186ae048IvxPIJeyEVNq7JGkJZw0Ey0VNHFNeL6ucTIHLCS9oDIxxLUwVAZEyAfLTohkzpOi";
        

        //*************************
        //   MAKE FEATURE LAYERS  
        //*************************

        const popupTemplate = {
            title: "Parcel TaxID:  {TAXID}",
            content: "Site Address: {FIRST_SITEADDR} <br>Zoning: {FIRST_ZONEDES1} ({FIRST_ZONING1}) <br>Property Use: {FIRST_PROPDESC} "
        };

        const parcelRenderer = {
            type: "simple",
            symbol: {
              type: "simple-fill",
            //   color: [255, 99, 71, 1],
              color: [255, 0, 0, .8],
            //   color: "red",
              outline: {
                  color: "black",
                  width: .25
              }
            }
        };

        // const parcelLayer = new FeatureLayer({ // property information layer
        //     url: "https://intervector.leoncountyfl.gov/intervector/rest/services/MapServices/TLC_OverlayPropInfo_Enhanced_D_WM/MapServer/1",
        //     // definitionExpression:   "ZONED in ( 'AC', 'CU-12', 'CU-18', 'CU-26', 'CU-45', 'UT', 'R-4', 'MR-1', 'OR-1', 'OR-2', 'OR-3', 'OA-1', 'C-1', 'C-2', 'CM', \
        //     //                                     'CP', 'UP-1', 'UP-2', 'M-1', 'PUD', 'U-PUD', 'IC', 'NBO', 'MR', 'MCN', 'GO-1', 'GO-2', 'NB-1', 'ASN-A', 'ASN-B', \
        //     //                                     'ASN-C', 'ASN-D', 'CC', 'SCD', 'UV', 'I', 'DRI', 'R' , 'UF') AND CITYINOUT = 'IN'",           
        //     // minScale: 0, 
        //     outFields:["TAXID", "SITEADDR", "SHAPE"],         
        //     popupTemplate: popupTemplate,
        //     renderer: parcelRenderer
        // });
        
        const parcelLayer = new FeatureLayer({ // Subset of property information layer
            url: "https://services.arcgis.com/ptvDyBs1KkcwzQNJ/arcgis/rest/services/PropInfo_eligible_parcels_dissolved/FeatureServer",
            popupTemplate: popupTemplate,
            renderer: parcelRenderer,
            minScale: 0, 
            title: "Eligible Parcels"
        });

        const heightLayer = new FeatureLayer({
            url: "https://services.arcgis.com/ptvDyBs1KkcwzQNJ/arcgis/rest/services/zoning_heights_MultipartToSi/FeatureServer",
            visible: false,
            title: "Allowed Heights",
        });

        const cityLimits = new FeatureLayer({
            url: "https://intervector.leoncountyfl.gov/intervector/rest/services/MapServices/TLC_Overlay_Citylimits_WM_D/MapServer/0",
            title: "City Limits",
            renderer: {
                type: "simple",
                symbol: {
                  type: "simple-fill",
                  color: null,
                  color: [247, 135, 2, .1],
                  outline: {
                      color: "grey",
                      width: 2
                  }
                }
            }
        });
        
        //***********************
        //   CREATE MAP & VIEW  
        //***********************

        const mapCenter = [-84.29, 30.44]; //Longitude, latitude:
        const zoomLevel = 13;

        const map = new Map({
            basemap: "streets-relief-vector",
            layers: [cityLimits, parcelLayer, heightLayer]
        });
        
        const view = new MapView({
            container: "viewDiv",
            map: map,
            center: mapCenter,
            zoom: zoomLevel
        });
        
        
        //***********************
        //   ADD SKETCH WIDGET  
        //***********************

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
                duplicateButton: false,
                settingsMenu: false,
                undoRedoMenu: false,
              }
        });


        //*******************************************************
        //   ADD SKETCH EVENTS TO LISTEN FOR AND EXECUTE QUERY 
        //*******************************************************

        sketch.on("update", (event) => {

            if (event.state === "start") {
                queryParcelLayer(event.graphics[0].geometry);
            }
            if (event.state === "complete"){
                graphicsLayerSketch.remove(event.graphics[0]); // Clear the graphic when a user clicks off it or sketches a new one
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
            color: [240, 140, 222, 0.25],
            outline: {
              color: [0, 0, 0, 0.5],
              width: 2
            }
        };


        //*********************
        //   INSTRUCTION BOX
        //*********************
        
        const instructBtn = document.getElementById("instructBtn");
        const instructDiv = document.getElementById("instructDiv");
        const closeBtn = document.getElementById("closeBtn");
        
        // since instruction panel is open by default, disable the button at first
        instructBtn.disabled = true
        
        // When the user clicks on the button, open the modal
        instructBtn.onclick = () => {
            instructDiv.style.display = "flow";
            instructBtn.disabled = true;
        }
        
        // When the user clicks on <span> (x), close the modal
        closeBtn.onclick = () => {
            instructDiv.style.display = "none";
            instructBtn.disabled = false;
        }
        
        
        //*******************
        //   RESET BUTTON
        //*******************
        const resetBtn = document.getElementById("resetBtn")
        
        resetBtn.onclick = () => { 
            view.graphics.removeAll() // removes the selected parcel highlights
            bufferLayer.graphics.removeAll() // removes the buffer circle graphic
            sketch.complete() // closes the sketch info panel, if open
            view.closePopup()
            view.center = mapCenter
            view.zoom = zoomLevel
            table1Div.style.display = "none"
            table2Div.style.display = "none"
            dateDiv.style.display = "none"
            parcelInfoDiv.style.display = "none"
            instructDiv.style.display = "flow"
            tablePlaceholder.style.display = "flow"
            resetBtn.style.display = "none"

            // reset the layers; using this because .remove(resultsHeightLyr) isn't working - need to review why
            map.layers = [cityLimits, parcelLayer, heightLayer, graphicsLayerSketch, bufferLayer]
        }
        

        //***************************
        //   CREATE OTHER WIDGETS
        //***************************
        const parcelInfoDiv = document.getElementById("parcelInfoDiv")
        const dateDiv = document.getElementById("dateDiv")
        const tablePlaceholder = document.getElementById("tablePlaceholder");
        const table1Div = document.getElementById("table1Div");
        const table2Div = document.getElementById("table2Div");
        const titleDiv = document.getElementById("titleDiv");
        const searchWidget = new Search({view: view});
        const zoom = new Zoom({view: view});
        const home = new Home({view: view});
        const legend = new Legend({view: view});

        // put the legend in an expand widget so it is hidden by default
        const legendExpand = new Expand({
            expandIcon: "legend",
            expandTooltip: "Legend",
            view: view,
            content: legend
        });

        // create a scale bar
        const scaleBar = new ScaleBar({
            view: view,
            unit: "imperial"
        });

        
        //***********************************
        //   ADD WIDGETS TO USER INTERFACE  
        //***********************************
        view.ui.empty("top-left");
        view.ui.add(tablePlaceholder, "manual");
        view.ui.add(table1Div, "manual");
        view.ui.add(table2Div, "manual");
        view.ui.add(instructDiv, "manual");
        view.ui.add(titleDiv, "top-left");
        view.ui.add(parcelInfoDiv, "top-left");
        view.ui.add(zoom, "bottom-left");
        view.ui.add(home, "bottom-left");
        view.ui.add(legendExpand, "bottom-left");
        view.ui.add(searchWidget, "bottom-left",);
        view.ui.add(instructBtn, "bottom-left");
        view.ui.add(scaleBar, "bottom-right");
        view.ui.add(dateDiv, "bottom-right");
        view.ui.add(sketch, "top-right");
        view.ui.add(resetBtn, "top-right");
        


        //************************************************************************
        //                               FUNCTIONS  
        //************************************************************************


        //********************************
        //   *** queryParcelLayer() ***
        //********************************
        function queryParcelLayer(geometry) {
            
            const parcelQuery = {
                spatialRelationship: "intersects", // Relationship operation to apply
                geometry: geometry,  // The sketch feature geometry
                outFields: ["TAXID","FIRST_SITEADDR"], // Attributes to return
                returnGeometry: true
            };
            
            parcelLayer.queryFeatures(parcelQuery)
            .then((results) => {
                            
                displayParcelResults(results);
                
            })
            .catch((error) => {
                console.log(error);
            });
            
        } // END queryParcelLayer()
        


        //**********************************
        // *** displayParcelResults() ***
        //**********************************
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
            const parcelAddress = results.features[0].attributes.FIRST_SITEADDR
            const parcelID = results.features[0].attributes.TAXID        
            parcelInfoDiv.innerHTML = `<b>Showing Results for:</b> ${parcelAddress} (Tax ID: ${parcelID})`
            parcelInfoDiv.style.display = "inline"
                    
            // create the buffer around the parcel
            bufferParcel(results.features[0].geometry);
            
            // Clear display
            view.closePopup();
            view.graphics.removeAll();
            
            // Add features to graphics layer
            view.graphics.addMany(results.features);

            // make reset button functional
            resetBtn.style.display = "flow"
            
        } // END displayParcelResults()
        
        

        //**************************
        //   *** bufferParcel ***
        //**************************
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


            
        //********************************
        //   *** queryHeightLayer() ***
        //********************************
        function queryHeightLayer(buffer) {
            
            const heightQuery = {
                spatialRelationship: "intersects", // Relationship operation to apply
                geometry: buffer,  
                outFields: ["OBJECTID", "ZONED", "ZONING", "Height_Name", "Height_Stories", "Height_Feet"], // Attributes to return
                returnGeometry: true,
            };
            
            heightLayer.queryFeatures(heightQuery)
            .then((results) => {
                
                displayHeightResults(results);
                
            }).catch((error) => {
                console.log(error);
            });
            
        } // END QueryHeightLayer
        
        

        //************************************
        //   *** displayHeightResults() ***
        //************************************
        let initialMapLayersLength = map.layers.length //global variable needed in function
        function displayHeightResults(results) {

            // If the "Zoning Districts Within 1 Mile" layer already exists, remove it. 
            // This will make the old subset disappear when the user clicks a new parcel.                 
            if (map.layers.length > initialMapLayersLength) {
                let zoningHeightLyrIndex = map.layers.findIndex(function(layer){
                    return layer.title === "Zoning Districts Within 1 Mile";
                });
                let heightSubsetLyr = map.layers.at(zoningHeightLyrIndex);
                map.layers.remove(heightSubsetLyr);
            }
            
            // polygon symbol definition
            const symbol = {
                type: "simple-fill",
                color: [ 120, 130, 200, 0.25 ],
                outline: {
                    color: [ 120, 130, 200, 1 ],
                    width: 1
                },
            };

            // label definition
            const heightsLabelClass = {
                symbol: {
                    type: "text",
                    // color: [ 120, 130, 200, 1 ],
                    color: "dimgray",
                    font: {
                        size: 8,
                        weight: "bold"
                    }
                },
                // labelPlacement: "above-center",
                labelExpressionInfo: {
                    expression: "$feature.ZONING"
                }
            };        
                        
            // create the new height layer from the query of which zoning districts intersect the 1 mile buffer
            let resultsHeightLayer = new FeatureLayer({
                source: results.features,
                title: "Zoning Districts Within 1 Mile",
                objectIdField: "OBJECTID",
                geometryType: "polygon",
                spatialReference: { //had to set since data from query was a different projection
                    wkid: 3857
                },
                renderer: {
                    type: "simple",
                    symbol: symbol                      
                },
                labelingInfo: [heightsLabelClass],
                fields: [{  
                    name: "OBJECTID",
                    type: "oid"
                }, {
                    name: "ZONING",
                    type: "string"
                }, {
                    name: "Height_Stories",
                    type: "integer"
                }, {
                    name: "Height_Feet",
                    type: "integer"
                }, {
                    name: "Height_Name",
                    type: "string"
                }],
                });

            // add results to the map & use to create tables
            map.add(resultsHeightLayer)
            makeFeatureTables(resultsHeightLayer)

            // update the dateDiv with the current date/time
            const date = new Date()
            dateDiv.innerHTML = `Results generated on: ${date}`
            dateDiv.style.display = "inline"
            
        } // END displayHeightResults()


            
        //*********************************    
        //   *** makeFeatureTables() *** 
        //*********************************    
        let featureTable, featureTable2 //global variables needed in function
        function makeFeatureTables(resultsHeightLayer){

            const featureLayer = resultsHeightLayer
            // featureLayer.title = "Zoning Districts Within 1 Mile";
            

            // ***********************************
            //   CREATE FEATURE TABLE #1 (Feet) 
            // ***********************************
            // create the table if this is a new query & update layer data if it is a repeat query
            if (featureTable === undefined) { //the Feature Table doesn't yet exist
                // Create the feature table
                featureTable = new FeatureTable({
                    layer: featureLayer,
                    container: table1Div,
                    view: view, // Required for feature highlight to work
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
            }          
            // END FEATURE TABLE #1
            

            // **************************************
            //   CREATE FEATURE TABLE #2 (Stories)
            // **************************************
            if (featureTable2 === undefined) { //the Feature Table doesn't yet exist
                // Create the feature table
                featureTable2 = new FeatureTable({
                    view: view,
                    layer: featureLayer,
                    container: table2Div,
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
            // END FEATURE TABLE #2

            // make tables visible & placeholder invisible
            table1Div.style.display = "flex";
            table2Div.style.display = "flex";
            tablePlaceholder.style.display = "none";

            // update table titles
            // let table1Title = document.getElementsByClassName("tableTitle")[0] 
            // let table2Title = document.getElementsByClassName("tableTitle")[1] 

            // table1Title.innerHTML = "Allowed Height in Feet"
            // table2Title.innerHTML = "Allowed Height in Stories"
                
        } // END makeFeatureTables()

}); // END main function