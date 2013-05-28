define({
    // Run function in given context
    proxy: function proxy(func, context) {
        return function() {
            func.apply(context, arguments);
        };
    },

    // Extend object with properties of another
    // Borrowed from Underscore.js: https://github.com/documentcloud/underscore
    extend: function extend(obj) {
        Array.prototype.forEach.call(
            Array.prototype.slice.call(arguments, 1), 
            function(source) {
                if (source) {
                    for (var prop in source) {
                        obj[prop] = source[prop];
                    }
                }
        });
        return obj;
    },

    // A beautiful piece of code, 1 in 2^^122 chance of collisions.
    // http://stackoverflow.com/a/2117523
    genUUID: function() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
            return v.toString(16);
        });
    },

    inherit: function(from, ownMethods) {
        var f = function(){};
        f.prototype = this.extend({}, from.prototype, ownMethods);

        // Init from parent prototype
        if (from.prototype.init !== undefined &&
            ownMethods.init !== undefined) {
            f.prototype.init = function() {
                from.prototype.init.apply(this, arguments);
                return ownMethods.init.apply(this, arguments);
            }
        }
        return f;
    },
});
