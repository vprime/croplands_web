app.factory('locationFactory', ['mappings', '$http', '$rootScope', '$filter', '$q', '$timeout', 'icons', 'log', function (mappings, $http, $rootScope, $filter, $q, $timeout, icons, log) {
    var _baseUrl = 'https://api.croplands.org',
        _cf = crossfilter(),
        l = {
            cf: {},
            markers: [],
            filters: {}
        };

    function updateSingleRecord(data) {
        var deferred = $q.defer();

        data = angular.copy(data);

        //Clear existing filters
        _.each(l.filters.list, function (filter) {
            l.cf.dims[filter.dim].filterAll();
        });

        // Filter by id
        l.cf.dims.id.filter(data.id);

        // Update old result if it exists
        if (l.cf.dims.id.top(Infinity).length) {
            var existingRecord = l.cf.dims.id.top(1)[0];

            // update data
            _.merge(existingRecord, data);

            // update the icon
            l.addIcon(existingRecord);
            deferred.resolve(existingRecord);
        }
        else {
            l.addIcon(data);
            _cf.add([data]);

            deferred.resolve(data);
        }
        log.info('Updated record #' + data.id, true);

        // Replace existing filters
        l.cf.dims.id.filterAll();

        l.returnMarkers();
        return deferred.promise;
    }

// Crossfilter Dimensions
    l.cf.dims = {
        id: _cf.dimension(function (d) {
            return d.id;
        }),
        year: _cf.dimension(function (d) {
            return d.year;
        }),
        landUseType: _cf.dimension(function (d) {
            return $filter('mappings')(d.land_use_type, "landUseType");
        }),
        crop: _cf.dimension(function (d) {
            return $filter('mappings')(d.crop_primary, "crop");
        }),
        water: _cf.dimension(function (d) {
            return $filter('mappings')(d.water, "water");
        }),
        intensity: _cf.dimension(function (d) {
            return $filter('mappings')(d.intensity, "intensity");
        }),
        spatial: _cf.dimension(function (d) {
            return {lat: d.lat, lon: d.lon};
        })
    };

//Crossfilter Groups
    l.cf.groups = {
        id: l.cf.dims.id.group(),
        year: l.cf.dims.year.group(),
        landUseType: l.cf.dims.landUseType.group(),
        crop: l.cf.dims.crop.group(),
        water: l.cf.dims.water.group(),
        intensity: l.cf.dims.intensity.group()
    };

// Filters
    l.filters.byPolygon = function (bounds, filterAll, echo) {
        // Filter markers from previous polygon or clear previous polygon and then filter
        if (filterAll === true || filterAll === undefined) {
            l.cf.dims.spatial.filterAll();
        }
        // Custom filter function
        l.cf.dims.spatial.filterFunction(function (d) {
            return  ((bounds.southWest.lng <= d.lon) &&
                (bounds.northEast.lng >= d.lon) &&
                (bounds.southWest.lat <= d.lat) &&
                (bounds.northEast.lat >= d.lat));
        });
        if (echo) {
            l.returnMarkers();
        }
    };
//    l.filters.year = function (start, end, echo, save) {
//        save = save === undefined ? true : save;
//        if (save) {
//            var args = [].slice.call(arguments);
//            args[3] = false;
//            l.filters.list.push({name: start, dim: 'year', func: l.filters.year, arguments: args});
//        }
//
//        end = end || start;
//        l.cf.dims.year.filterRange([start, end + 1]);
//        if (echo) {
//            l.returnMarkers();
//        }
//
//    };

    l.filters.years = function (years, echo) {
        l.cf.dims.year.filterFunction(function (d) {
            return years[d].selected;
        });
        if (echo) {
            l.returnMarkers();
        }
    };

    l.filters.landUseType = function (type, echo) {
        // Takes an array of cropland using the land use integer number
        l.cf.dims.landUseType.filterFunction(function (d) {
            return type[d].selected;
        });
        if (echo) {
            l.returnMarkers();
        }
    };
    l.filters.crops = function (crops, echo) {
        // Takes an array of crops using the crops integer number
        l.cf.dims.crop.filterFunction(function (d) {
            return crops[d].selected;
        });
        if (echo) {
            l.returnMarkers();
        }
    };

    l.filters.intensity = function (intensity, echo) {
        // Takes an array of intensities using the intensity integer number
        l.cf.dims.intensity.filterFunction(function (d) {
            return intensity[d].selected;
        });
        if (echo) {
            l.returnMarkers();
        }
    };

    l.filters.water = function (water, echo) {
        // Takes an array of water use types using the integer number
        l.cf.dims.water.filterFunction(function (d) {
            return water[d].selected;
        });
        if (echo) {
            l.returnMarkers();
        }
    };

    l.filters.reset = function () {
        _.each(l.cf.dims, function (dim) {
            dim.filterAll();
        });
    };

    l.clearAll = function () {
        l.filters.reset();
        _cf.remove();
    };

    l.clear = function (dim) {
        l.cf.dims[dim].filterAll();
        _.remove(l.filters.list, function (filter) {
            return filter.dim === dim;
        });
        l.returnMarkers();
    };

// Return filtered markers
    l.returnMarkers = function () {
        l.markers = l.cf.dims.year.top(10000);
        console.log(l.cf.dims.year.top(Infinity));
        log.info('Markers Filtered');
        $rootScope.$broadcast("locationFactory.markers.filtered");

    };
// Download All Markers
    l.getMarkers = function () {

        // Remove all existing location
        l.clearAll();
            var file1 = $q.defer(),
                file2 = $q.defer(),
                file3 = $q.defer();


        $http({method: 'GET', url: '/s3/json/records.p1.json'}).
            success(function (data) {
                l.addMarkers(data).then(function () {
                    file1.resolve();
                });
            });
        $http({method: 'GET', url: '/s3/json/records.p2.json'}).
            success(function (data) {
                l.addMarkers(data).then(function () {
                    file2.resolve();
                });
            });
        $http({method: 'GET', url: '/s3/json/records.p3.json'}).
            success(function (data) {
                l.addMarkers(data).then(function () {
                    file3.resolve();
                });
            });
        $q.all([file1, file2, file3]).then(function () {
            $rootScope.$broadcast("locationFactory.markers.downloaded");
            l.returnMarkers();
        }, function () {
            log.warn("Could not download locations.", true);
            l.returnMarkers();
        });
    };

    l.addIcon = function (record) {
        if (record.land_use_type === 1) {
            var iconString = "iconCropland";
            iconString += $filter('mappings')(record.intensity, "intensity");
            iconString += $filter('mappings')(record.water, "water");
            if (icons[iconString] === undefined) {
                log.error('No icon exists for class');
            }
            record.icon = icons[iconString];
        } else {
            record.icon = icons.iconNotCropland;
        }
    };


    l.addMarkers = function (data) {
        var deferred = $q.defer(),

            keys = data.meta.columns,
            records = [];

        (function () {
            for (var n = 0; n < data.objects.length; n++) {
                var record = {};

                for (var i = 0; i < keys.length; i++) {
                    record[keys[i]] = data.objects[n][i];
                }

                l.addIcon(record);
                records.push(record);
            }
            _cf.add(records);
            deferred.resolve();
        })();


        return deferred.promise;
    };

// Download Single Marker with Details
    l.getLocation = function (id, callback, attemptsRemaining) {
        l.changeMarkerIcon(id);

        $http({method: 'GET', url: _baseUrl + '/api/locations/' + String(id)}).
            success(function (data, status, headers, config) {
                _.map(data.history, function (d) {
                    d.data = JSON.parse(d.data);
                });

                // sort records by most recent first
                data.records = _.sortBy(data.records, function (record) {
                    var index = -(record.year * 100 + record.month);
                    return index;
                });

                callback(data);
            }).
            error(function (data, status, headers, config) {
                if (status === 500) {
                    log.warn('Error retrieving location');
                    $timeout(function () {
                        if (attemptsRemaining === undefined) {
                            attemptsRemaining = 3;
                        }
                        if (attemptsRemaining > 0) {
                            l.getLocation(id, callback, attemptsRemaining);
                        }
                    }, 1000);
                }
                // called asynchronously if an error occurs
                // or server returns response with an error status.
            });
    };

    l.changeMarkerIcon = function (id) {
        l.cf.dims.id.filter(id);
        _.map(l.cf.dims.id.top(Infinity), function (record) {

            // Get existing marker type and append visited
            _.forOwn(icons, function (val, key) {
                if (record.icon === val) {
                    // If already marked visited
                    if (key.indexOf('Visited') > -1) {
                        return record;
                    }
                    if (icons[key + "Visited"]) {
                        record.icon = icons[key + "Visited"];
                    }
                    else {
                        log.warn("No visited marker exists for: " + key, true);
                    }
                    return record;
                }
            });

            return record;
        });
        l.cf.dims.id.filterAll();

    };

    l.getTotalRecordCount = function () {
        return _cf.size();
    };

    l.getFilteredRecordCount = function () {
        return l.cf.dims.year.top(Infinity).length;
    };
    l.postLocation = function (location, callback) {
        // Send to Server
        location.source = 'web app';
        location.accuracy = 0;
        return $http({method: 'POST', url: 'https://api.croplands.org/api/locations', data: location})
    };
    l.saveRecord = function (record, callback) {
        var deferred = $q.defer(),
            data = {}, method, id, url = 'https://api.croplands.org/api/records', allowedFields = ['id', 'land_use_type', 'water', 'crop_primary', 'crop_secondary', 'location_id', 'year', 'month'];

        data = angular.copy(record);
//        // Remove keys users cannot change

        _.each(Object.keys(data), function (key) {
            if (!_.contains(allowedFields, key)) {
                delete data[key];
            }
        });

        // Post or Patch
        if (data.id) {
            method = 'PATCH';
            url += "/" + data.id.toString();
        } else {
            method = 'POST';
        }

        // Send to Server
        $http({method: method, url: url, data: data}).
            success(function (data) {
                // add location info for new records
                data.lat = record.lat;
                data.lon = record.lon;
                // update crossfilter

                updateSingleRecord(data).then(function (data) {
                    deferred.resolve(data);
                });

            }).
            error(function (data, status) {
                deferred.reject();
            });

        return deferred.promise;
    };

    /*
     Returns a csv string of the currently filtered locations.
     #TODO add more columns for greater value(source, quality)
     */
    l.getCSV = function () {

        var records = l.cf.dims.year.top(Infinity);
        var csv = [
            ["location_id, record_id, lat, lon, year, land_use_type, water, intensity, crop_primary"]
        ];
        _.each(records, function (record) {
            var recordString = [record.location_id,
                record.id,
                record.lat,
                record.lon,
                record.year,
                mappings.landUseType.choices[record.land_use_type].label,
                mappings.water.choices[record.water].label,
                mappings.intensity.choices[record.intensity].label,
                mappings.crop.choices[record.crop_primary].label
            ].join(",");
            csv.push(recordString);
        });
        return csv.join('\r\n');

    };
    return l;
}]);