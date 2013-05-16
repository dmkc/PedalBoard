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


require(['master', 'slave', 'peerbb', 'peerui', 'jquery-1.9.1.min'], 
        function(Master, Slave, PeerUI, jQuery) {
    var peer;
    console.log(Master, Slave);       

    window.Backbone = Backbone;

    TestModel = Backbone.SyncModel.extend({
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
        var model = new TestModel(),
            sliderView,
            sliderEl = function(){return document.querySelector('#testSlider')};

        Backbone.SyncRouter.init( (master) ? new Master() : new Slave() );
        // Slave setup
        Backbone.SyncRouter.on('model_new', function(data) {
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
            model.set('slider', 1);
            Backbone.SyncRouter.on('connection_state', function(e){
                console.log("New peer. Subsribing to model");
                if (e.state == 'open') {
                    model.subscribe(e.client_id);
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

