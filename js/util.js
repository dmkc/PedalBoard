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


    // TODO: Just use underscore
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
