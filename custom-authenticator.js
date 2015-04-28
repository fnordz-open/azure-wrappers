"use strict";

var debug = false,
    customAuthenticator;
    
exports.createAuthenticator = function (settings) {
    return Object.create(customAuthenticator).init(settings);
};
    
customAuthenticator = {    
    expirySecondsSpan: 20 * 60, //20 minutes
    
    hasherModule: null,
    
    //settings:
    //      masterKey
    //          can be obtained: tables - require('mobileservice-config').masterKey
    //                           api    - request.service.config.masterKey
    //      zumoSettings object(optional)
    //          properties: aud, iss, ver
    //
    //      expirySecondsSpan (options)
    //          how many seconds the user token will valid
    init: function (settings) {
        this.hasherModule = require('./hasher.js').createHasher(settings);
        
        settings.expirySecondsSpan && (this.expirySecondsSpan = settings.expirySecondsSpan);
        
        return this;
    },
    
    //authInput = {password: <plain text password>, salt: <salt string>}
    //opts = {success: fn(){...}, error: fn(){...}}
    validatePassword: function (authInput, hashedPassword, opts) {
        opts || (opts = {});
        
        this.hasherModule.hash(
            authInput.password, 
            authInput.salt,
            function (err, hashedInput) {
                if (err) {
                    console.error('severity error hashing password', err);
                    opts.error && opts.error(err);
                    return;
                }
                
                if (this.hasherModule.s_slowEquals(hashedInput, hashedPassword)) {
                    opts.success && opts.success();
                } else {
                    opts.error && opts.error();
                }
            }.bind(this)
        );
    },
    
    //generateAuth(password, [salt,] callback);
    //password <plain text password>
    //callback params: {password: ..., salt: ...}
    //optionally a salt can be passed to avoid the generation of a random one by the function
    generateAuth: function (password, salt, callback) {
        if (typeof salt === 'function') {
            callback = salt;
            salt = this.hasherModule.randomChain();
        }
        
        this.hasherModule.hash(password, salt, function (err, hashedPassword) {
            if (err) return callback({error: err});
            
            callback({
                password: hashedPassword,
                salt: salt,
            });
        });
    },
    
    authenticate: function (userId, expirySecondsSpan) {
        var expiryDate = new Date();
        
        expirySecondsSpan || (expirySecondsSpan = this.expirySecondsSpan);
        
        expiryDate.setUTCSeconds(expiryDate.getUTCDate() + expirySecondsSpan);
        
        return {
            id: userId,
            token: this.hasherModule.zumoJwt(expiryDate.valueOf(), userId),
            expires: expiryDate.valueOf()
        };
    },
};

