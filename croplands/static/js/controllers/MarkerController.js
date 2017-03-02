/**
 * Created by Corryn Smith on 2/22/2017.
 */

app.controller('MarkersSimpleController', [ '$scope', function($scope) {
            var mainMarker = {
                lat: 0,
                lng: 0,
                focus: true,
                message: "Hey, drag me if you want",
                draggable: true
            };

            angular.extend($scope, {
                world: {
                    lat: 0,
                    lng: 0,
                    zoom: 1
                },
                markers: {
                    mainMarker: angular.copy(mainMarker)
                },
                position: {
                    lat: 0,
                    lng: 0
                },
                events: { // or just {} //all events
                    markers:{
                      enable: [ 'dragend' ]
                      //logic: 'emit'
                    }
                }
            });

            $scope.$on("leafletDirectiveMarker.dragend", function(event, args){
                $scope.position.lat = args.model.lat;
                $scope.position.lng = args.model.lng;
            });

        } ]);