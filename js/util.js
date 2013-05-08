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
    }
});
