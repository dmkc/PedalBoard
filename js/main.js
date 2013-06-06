requirejs.config({
    shim: {
      "backbone": {
          deps: ["underscore", 'jquery-1.9.1.min'],
          exports: "Backbone"
      },
      "underscore": {
          exports: "_"
      },
      "jquery-1.9.1.min": {
          exports: "jQuery"
      }
    }
});


require(['rtc/master', 'rtc/slave', 'rtc/syncmodel', 'peerui', 'jquery-1.9.1.min', 'audio/pedals'], 
        function(Master, Slave, Backbone, PeerUI, jQuery, Pedals) {
    var peer;

    window.Backbone = Backbone;
    window.Pedals = Pedals;

    var TestModel = Backbone.SyncModel.extend({
        name: 'TestModel'
    });

    TestView = Backbone.View.extend({
        init: function() {
            var that = this;

            this.listenTo(this.model, 'change', this.render);
            this.$el.on('change', function() {
                that.model.set('slider', that.$el.val());
            });
            this.render();

            return this;
        },

        render: function() {
            this.$el.val(this.model.get('slider')); 
        }
    });


    if(window.location.hash == '#slave') {
        startTest(false);
    } else if (window.location.hash == '#master') {
        startTest(true);
    }

    function startTest(master) {
        var model,
            sliderView,
            sliderEl = function(){return document.querySelector('#testSlider')};

        
        peer =  (master) ? new Master() : new Slave();
        PeerUI.init(peer);
        Backbone.SyncRouter.init(peer);

        // Slave setup
        Backbone.SyncRouter.on('model_sync', function(data) {
            console.log('New SyncModel init request', data);
            window.model = data.model;
            sliderView  = new TestView({
                model: data.model,
                el: sliderEl
            }).init();
            window.sliderView = sliderView;
        });

        // Master setup
        if(master) {
            model = new TestModel()
            llist = new Backbone.SyncLList({id:'_views'})
            // Test out linked list
            llist.add(model)
            llist.add(new TestModel())

            model.set('slider', 1);
            Backbone.SyncRouter.on('data_channel_state', function(e){
                console.log("New peer connection");

                if (e.state == 'open') {
                } else {
                    console.log('Closed connection to peer', e.client_id);
                }
            }, 1000);

            sliderView  = new TestView({
                model: model,
                el: sliderEl
            }).init();
        }

        window.model = model;
        window.sliderView = sliderView;
    }

    document.querySelector('#makeSlave').addEventListener('click', function(){
        startTest(false);
    });
    document.querySelector('#makeMaster').addEventListener('click', function(){
        startTest(true);
    });
    document.querySelector('#sendButton').addEventListener('click', function(){
        peer.sendToAll(document.getElementById('dataChannelSend').value)
    });


});

