define(
    ['util', 'rtc/syncmodel'], function(){
    var Models = {
        CompressorModel: Backbone.SyncModel.extend({
            name: 'CompressorModel',
        }),

        StereoChorusModel: Backbone.SyncModel.extend({
            name: 'StereoChorusModel',
        }),
    };

    return Models;
});
