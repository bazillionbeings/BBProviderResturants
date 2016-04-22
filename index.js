'use strict';

const rp = require('request-promise'),    
    foursquare = require('node-foursquare-venues'),
    config = require('./config.json'),
    optionSchema = require('./optionSchema.json');

class ResturantProvider {
    
    constructor() {
        this._foursquare = foursquare(config.clientId, config.clientSecret);
    }
    
    static get ontologyClass() {
        return 'FOOD INTEREST';
    }

    static get ontologySubclass() {
        return 'RESTAURANTS';
    }

    static get ontologyAttributes() {
        return [];
    }
    
    static get optionSchema() {
        return optionSchema;
    }
    
    execute(input, options) {
        return new Promise((resolve, reject) => {            
            this._foursquare.venues.explore({
                ll: `${options.latitude},${options.Longitude}`,
                section: 'food'
            }, (statusCode, result) => {
                let returnResult = []; 
                let groupItems = result.response.groups[0].items;
                for (let groupItem of groupItems) {
                    let venue = groupItem.venue;
                    returnResult.push({
                        link: `https://foursquare.com/v/${venue.id}`,
                        media: 'venue',
                        country: null,
                        type: null,
                        name: venue.name,
                        _locationLat: venue.location.lat,
                        _locationLong: venue.location.lng
                    });                    
                }
                resolve(returnResult);
            });             
        });        
    }   
}

// new ResturantProvider().execute([{name: 'Jack the Horse Tavern'}], {ll: '40.7,-74'}).catch(console.error);

module.exports = ResturantProvider;