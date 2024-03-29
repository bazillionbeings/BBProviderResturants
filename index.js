'use strict';

const rp = require('request-promise'),
    foursquare = require('node-foursquare-venues'),
    config = require('./config.json'),
    optionSchema = require('./optionSchema.json');

class ResturantProvider {

    /*_categoryRec(categories, result, save) {
        for (let category of categories) {
            if (category.categories.length > 0) {
                this._categoryRec(category.categories, result, category.name === 'Food' || save);
            }
            if (save) result.push(category.name);            
        }
    }*/

    constructor() {
        this._foursquare = foursquare(config.clientId, config.clientSecret);
        /*this._foursquare.venues.categories((statusCode, result) => {
            this._categories = result.response.categories;
            let flatCategories = [];
            this._categoryRec(this._categories, flatCategories);
            
            //console.log(JSON.stringify(this._categories));
            console.log(flatCategories);
        });*/
    }

    static get ontologyClass() {
        return 'FoodInterest';
    }

    static get ontologySubclass() {
        return 'Restaurants';
    }

    static get ontologyAttributes() {
        return ['type', 'country'];
    }

    static get optionSchema() {
        return optionSchema;
    }

    _constructReturnVenue(venue, country) {
        let categories = [];
        if (venue.categories) {
            categories = venue.categories.map(category => category.name);
        }
        return new Promise((resolve, reject) => {
            let formattedVenue = {
                class: 'FoodInterest',
                subclass: 'Restaurants',
                url: `https://foursquare.com/v/${venue.id}`,
                weburl: `https://foursquare.com/v/${venue.id}`,
                source: 'foursquare',
                type: 'venue',
                name: venue.name,
                tags: [],
                attributes: {
                    _locationLat: venue.location.lat,
                    _locationLong: venue.location.lng,
                    type: categories,
                    country
                }
            };
            this._foursquare.venues.photos(venue.id, {}, (statusCode, result) => {
                for (let item of result.response.photos.groups) {
                    if (item.name === 'Venue photos') {
                        if (item.items.length > 0) {
                            formattedVenue.backgroundImageUrl = `${item.items[0].prefix}original${item.items[0].suffix}`;
                        }
                        break;
                    }
                }
                resolve(formattedVenue);
            });
        });
    }

    execute(input, options) {
        return new Promise((resolve, reject) => {
            let resultPromises = [];
            let googleApiPromises = [];
            for (let attrs of input) {
                let country;
                let requestOptions = {
                    ll: `${options.latitude},${options.Longitude}`,
                    section: 'food'
                };                
                let googleApiPromise = rp.get({
                    url: `https://maps.googleapis.com/maps/api/geocode/json?latlng=${requestOptions.ll}&key=${config.googleMapsGeocodingAPIKey}`,
                    json: true
                }).then(body => {
                    let address = body.results[0].address_components;
                    //more likely to be at the ending
                    for (let i = address.length - 1; i >= 0; i--) {
                        if (address[i].types.findIndex(element => element === 'country') !== -1) {
                            country = address[i].long_name;
                            break;
                        }
                    }

                    for (let attrKey in attrs) {
                        switch (attrKey) {
                            case 'type':
                                //"query" has been used instead of "categorie" query option since API has bugs
                                attrs.type = attrs.type.trim().toLowerCase();
                                requestOptions.query = attrs.type;
                                break;
                            case 'country':
                                if (country !== attrs.country) {
                                    delete requestOptions.ll;
                                    requestOptions.near = attrs.country;
                                    country = attrs.country;                                    
                                }
                                break;
                        }
                    }
                    let resultPromise = new Promise((resolve, reject) => {
                        this._foursquare.venues.explore(requestOptions, (statusCode, result) => {
                            let returnResult = [];
                            let venues = result.response.groups[0].items.map(groupItem => groupItem.venue);
                            let venuePromises = [];                            
                            if (attrs.type) {
                                for (let venue of venues) {
                                    if (venue.categories) {
                                        for (let category of venue.categories) {
                                            if (category.name.toLowerCase() === attrs.type) {                                                
                                                venuePromises.push(this._constructReturnVenue(venue, country).then(venue => {
                                                    returnResult.push(venue);
                                                }).catch(reject));
                                                break;
                                            }
                                        }
                                    }
                                }
                            } else {
                                for (let venue of venues) {
                                    venuePromises.push(this._constructReturnVenue(venue, country).then(venue => {
                                        returnResult.push(venue);
                                    }).catch(reject));
                                }
                            }
                            Promise.all(venuePromises).then(() => resolve(returnResult), reject).catch(reject);
                        });
                    });
                    resultPromises.push(resultPromise);
                });
                googleApiPromises.push(googleApiPromise);                
            }
            Promise.all(googleApiPromises).then(() => {
                Promise.all(resultPromises).then(result => {
                    resolve(result.reduce((prev, curr) => prev.concat(curr)));
                }, reject).catch(reject);    
            }, reject).catch(reject);
        });
    }
}

// new ResturantProvider().execute([{ country: 'Germany' }], { latitude: 40.7, Longitude: -74 }).then(result => console.dir(result, {depth: null})).catch(console.trace);

module.exports = ResturantProvider;