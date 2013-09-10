// ==UserScript==
// @name            Blipera
// @author          ^eriz
// @version         0.0.14
// @include         http://blip.pl/dashboard
// @include         http://blip.pl/users/*/dashboard
// @include         http://blip.pl/s/*
// @include         http://blip.pl/dm/*
// @include         http://blip.pl/pm/*
// @include         http://blip.pl/tags/*
// @include         http://blip.pl/
// ==/UserScript==

/**
 * blipera, BLIP enhancement for Opera
 * created by eRIZ - http://eriz.pcinside.pl
 * http://blipera.pcinside.pl
 * or BLIP -> ^eriz
 *
 * changelog
 0.0.1
    + initial build, reply and quote function
 0.0.2
    + flaker ignoring
 0.0.3
    + expanding citations
 0.0.4
    x fixed citations
 0.0.5
    + changelog started ;)
    + changed citation expanding method -> now it's a layer with clickable elements
 0.0.6
    + avatar enlarger
    + rewritten - objective JS
 0.0.7
    x fixed missing expression
    x renamed
 0.0.8
    x fixed username matching expression
    x settings fix
 0.0.9
    x fixed filtering
 0.0.10
    x fixed @include - added tags, thx ^stivo
    x pagination works again
    x existing cites too
 0.0.11
    x parsing terminated on cite
    x tags in citations were broken at Polish national characters
    x don't add avatar enlarger if it's default "face"
    x missing space in citations after colon
    + citation has own toolbar just like normal status
 0.0.12
    + API for once executed plugins
    + API to determine, where we are
    + single messages API
    x bad links - sorry ;)
    x bad links in cites
 0.0.13
    + "in new tab" checkbox in "jump to" box.
    i recommend box rewritten as plugin
    $ "post to facebook" switch - no need to type "+fb"
    x fixed issue with fresh user; no errors if no pagination found
 0.0.14
    x fixed attachEvent - how could I do that? ;)
 */


(function(){

    // determine, where we are
    var regex = /\/([^\/]+)/i;
    if(window.location.pathname=='/'){
        var where = 'bliposphere';
    }else{
        var where = regex.exec(window.location.pathname)[1];
    }


    // UJS SETTINGS (TODO: use localStorage to save and GUI to set)

    var settings = {
        filters: {},
        enhancements: {},
        plugins: {}
    }

    // ENHANCEMENTS LIST; names as settings in order to easily use in settings

    var enhancements = {}
    var filters = {}
    var plugins = {}

    // PARSE EACH NODE

    var parseNode = function(node){
        // enhancements
        for(i in settings.enhancements){
            settings.enhancements[i] && enhancements[i](node);
        }
    }

    // OVERLOAD Prototype functions
    var overload = function(){
        // extract item ID
        var Rexpr = /update\-([0-9]+)/i;
        // overload Prototype's method
        var o = Element.insert;
        Element.insert = function(a,b){

            // don't parse if paginated - sniffEvents takes care of pages
            if(b.bottom){
                return o(a,b);
            }

            // execute filters
            for(i in filters){

                if(filters[i] && (filters[i].test(b.top) || filters[i].test(b.bottom))){
                    return;
                }
            }

            // use Prototype's previous method:
            o(a,b);

            var ID = Rexpr.exec(b.top)[1];

            // and parse
            parseNode(document.getElementById('update-'+ID));

            // broken "return" but works fine without :)
        }
    }

    // process already existing nodes
    var processExisting = function(){
        // get all items
        var items = document.getElementsByClassName('update');
        for(var i=0;i<items.length;i++){
            for(j in filters){
                if(filters[j] && filters[j].test(items[i].innerHTML)){
                    items[i].parentNode.removeChild(items[i]);
                    continue;
                }
            }

            parseNode(items[i]);
        }
    }

    // execute plugins
    var executePlugins = function(){
        for(i in plugins){
            plugins[i]();
        }
    }

    // sniff Blip's events
    var sniffEvents = function(){

        if(where!='tags' && where!='dashboard'){
            return;
        }

        // handle pagination, weird way
        var obj = document.getElementById('page-number');

        // fresh user, give up
        if(!obj){
            return;
        }
        
        obj.update = function(arg){
            processExisting();
            // DIRTY workaround; coz' something was going wrong if I was executing old function within
            obj.innerHTML = arg;
        };
    }

    // API function -> node2blip object
    var blipCache = {}; // cache
    // ID
    // author
    // recipient
    // type: status/dm/pm
    // timestamp
    // transport
    // content

    var node2blip = function(node){
        var IDexpr = /update\-([0-9]+)/i;
        var authorExpr = /http\:\/\/blip\.pl\/users\/([^\/]+)/i;
        var ID = IDexpr.exec(node.getAttribute('id'))[1];

        if(blipCache[ID]!=null){
            return blipCache[ID];
        }

        var data = {
            ID: ID,
            author: authorExpr.exec(node.getElementsByClassName('author')[0].getAttribute('href'))[1],
            timestamp: parseInt(node.getElementsByClassName('created-at-epoch')[0].innerHTML),
            transport: node.getElementsByClassName('transport')[0].getElementsByTagName('a')[0].innerHTML,
            content: node.getElementsByClassName('content')[0].innerHTML,
            type: 'status'
        };

        var author = node.getElementsByClassName('nick')[0].getElementsByTagName('a');
        if(author.length>0){
            data.recipient = authorExpr.exec(author[1].getAttribute('href'))[1];
            data.type = author.parentNode.className.indexOf('private')>-1 ? 'pm' : 'dm';
        }

        blipCache[ID] = data;
        return data;
    };

    var fetchBlip = function(ID, callback){

        new Ajax.Request('http://api.blip.pl/statuses/'+ID+'.json',
        {
          method:'get',
          onSuccess: function(what, resp){
            callback(resp);
          },
          onFailure: function(){ alert('Przeciążone.') }
        });
    };

    var getStatusById = function(ID, callback){

        if(blipCache[ID]){
            callback(blipCache[ID]);
        }else{

            var uexpr = /\/(.*)$/i;

            fetchBlip(ID, function(resp){
                var data = {
                    ID: ID,
                    author: uexpr.exec(resp.user_path)[1],
                    timestamp: resp.created_at,
                    transport: resp.transport_description,
                    content: resp.body,
                    type: resp.type.toLower()
                }
                blipCache[ID] = data;

                callback(data);
            });


        }
    };



    blipera = {
        addEnhancement: function(name, enhancement){
            enhancements[name] = enhancement;
            settings.enhancements[name] = true;
        },
        addFilter: function(name, expression){
            filters[name] = expression;
            settings.filters[name] = true;
        },
        addStyle: function(expression){
            var def = document.createElement('style');
            def.innerHTML = expression;
            document.getElementsByTagName('head')[0].appendChild(def);
        },
        addPlugin: function(name, plugin, onReady){
            if(!onReady){
                plugin();
                return;
            }
            plugins[name] = plugin;
        },
        settings: settings,
        init: function(){
            processExisting();
            overload();
            sniffEvents();
            executePlugins();
        },
        where: where,
        node2blip: node2blip,
        getStatusById: getStatusById
    }
})();

blipera.addStyle('div.cite { border: 1px solid #CCC; padding: 2px; margin: 10px 0 0 0; }');
blipera.addStyle('ul.citeToolbar { list-style: none; padding: 1px 0 0 0; margin: 0 0 10px 0; overflow: hidden; clear: both;}');
blipera.addStyle('ul.citeToolbar a { margin: 0 0 0 3px; float: right; cursor: pointer; border-left: 1px solid #CCC; padding: 0 0 0 3px; }')
blipera.addStyle('ul.citeToolbar a:last-child { border-left: 0; }')
blipera.addEnhancement('expandCitations', function(node){
    // expressions
    // tags
    var Rtag = /#([^ \.\']+)/gi
    // extract citation
    var Rcite = /http\:\/\/([www\.]?)blip.pl\/(s|dm)\/([0-9])+/i;
    // user dashboard
    var Ruser = /\^([^\ ]+)/g;
    // http links
    var Rlink = /[^"]http\:\/\/([^\ ]+)/gi;
    // cite author
    var RciteUser = /^([a-z0-9]+)[^a-z0-9]/i;


    // to sniff citations, get all links
    var links = node.getElementsByClassName('content')[0].getElementsByTagName('a');
    // if there are any?
    if(links){
        // iterate
        for(var i=0;i<links.length;i++){
            // and skip everything not matching citation
            if(!Rcite.test(links[i].getAttribute('href'))){
                continue;
            }

            // new element
            var cite = document.createElement('div');
            // get content
            var content = links[i].getAttribute('title');
            // avoid recursion
            if(!content){
                continue;
            }

            content = new String(content);

            // replace tag links
            content = content.replace(Rtag, '<a href="http://blip.pl/tags/$1">#$1</a>');
            // replace user links
            content = content.replace(Ruser, '<a href="http://blip.pl/users/$1/dashboard">^$1</a>');
            // replace cite author
            var author = RciteUser.exec(content)[1];
            content = content.replace(RciteUser, '<a href="http://blip.pl/users/$1/dashboard">$1</a>: ');

            // replace links
            content = content.replace(Rlink, '<a href="http://$1">http://$1</a>');

            // fetch citation link
            var permalink = links[i].getAttribute('href');

            // specify class
            cite.className = 'cite';
            // and pump html
            cite.innerHTML = content;

            // uses less resources
            var toolbar = document.createDocumentFragment();
            // create new list
            var container = document.createElement('ul');
            container.className = 'citeToolbar';

            // reply
            var buttonItem = document.createElement('li');
            var button = document.createElement('a');
            button.appendChild(document.createTextNode('odpowiedz'));
            button.onclick = function(){
                window.BLIP.dashboardInput.respondTo(author);
                return false;
            }
            buttonItem.appendChild(button);
            container.appendChild(button);

            // cite
            var buttonItem = document.createElement('li');
            var button = document.createElement('a');
            button.setAttribute('href', permalink);
            button.appendChild(document.createTextNode('cytuj'));
            button.onclick = function(){
                window.BLIP.dashboardInput.quote(this.href);
                return false;
            }
            buttonItem.appendChild(button);
            container.appendChild(button);

            // permalink
            var buttonItem = document.createElement('li');
            var button = document.createElement('a');
            button.appendChild(document.createTextNode('link'));
            button.setAttribute('href', permalink);
            buttonItem.appendChild(button);
            container.appendChild(button);

            // reply and quote
            var buttonItem = document.createElement('li');
            var button = document.createElement('a');
            button.setAttribute('href', permalink);
            button.appendChild(document.createTextNode('reply&q'));
            button.onclick = function(){
                window.BLIP.dashboardInput.respondTo(author)
                window.BLIP.dashboardInput.quote(this.href);
                return false;
            }
            buttonItem.appendChild(button);
            container.appendChild(button);

            // add list to container
            toolbar.appendChild(container);

            // ...replace link with citation object
            var parent = links[i].parentNode
            parent.replaceChild(cite, links[i]);
            // huh, I've not found insertAfter natively
            parent.insertBefore(toolbar, cite.nextSibling);
        }
    }
})

blipera.addEnhancement('avatarToolbar', function(node){

    // avatar toolbar
    var container = node.getElementsByClassName('container')[0];
    var img = container.getElementsByTagName('img');

    // if cite
    if(img.length==0){
        return;
    }

    var link = img[0].getAttribute('src');

    // if it's default avatar - ignore
    if(link.indexOf('nn.png')>-1){
        return;
    }

    link = link.replace('_pico', '');
    var enlarge = document.createElement('a');
    enlarge.className = 'enlarge';
    enlarge.onclick = function(){
        window.open(link, 'avatar', '');
        return false;
    }

    container.appendChild(enlarge);
});
blipera.addStyle('.status .container { position: relative; }');
blipera.addStyle('.status .container a.enlarge { content: "+"; position: absolute; top: 37px; left: -10px; padding: 0 3px; height: 16px; width: 9px; background: #EEE; }');
blipera.addEnhancement('tuneToolbar', function(node){
    // toolbar insertion

    var respond = node.getElementsByClassName('respond');

    if(respond.length==0){
        return;
    }

    respond = respond[0].onclick;

    var quote = node.getElementsByClassName('permalink')[0].getAttribute('href');

    // new item
    var rAndQ = document.createElement('a');
    rAndQ.appendChild(document.createTextNode('reply&q | '));
    rAndQ.onclick = function(){
        respond();
        window.BLIP.dashboardInput.quote(quote);
        return false;
    }
    rAndQ.className = 'quote';

    node.getElementsByClassName('toolbar')[0].appendChild(rAndQ);
});

blipera.addFilter('flaker', /!flaker/i);


blipera.settings.plugins.hideRecommended = true;
blipera.addEnhancement('hideRecommended', function(){
    blipera.addStyle('#recommended-box { display: none; }');
}, true);

blipera.settings.plugins.jumpIntoNew = true;
blipera.addPlugin('jumpIntoNew', function(){

    // dirty - repeat Blip's code because no hook found... oh, window.location is not overrideable

    opera.defineMagicFunction('setupQuickJump', function(e){

        // input code

        var intoNew = document.createDocumentFragment();
        var chk = document.createElement('input');
        chk.setAttribute('type', 'checkbox');
        chk.setAttribute('id', 'jumpIntoNew');

        intoNew.appendChild(chk);

        var label = document.createElement('label');
        label.setAttribute('for', 'jumpIntoNew');
        label.appendChild(document.createTextNode('na nowej karcie'));
        intoNew.appendChild(label);

        var jump = document.getElementById('jump');
        jump.appendChild(intoNew);

        // blip code

        var obj = document.getElementById('jump-content');
        var f = $('jump-type');
        var g = $('jump-content');
        var h = /^(\^|\>|#)/;
        Event.observe(document, 'dom:loaded', function () {
            f.observe('change', function (a) {
                g.value = g.value.replace(h, '');
                g.value = f[f.selectedIndex].value + g.value
            });
            g.observe('keyup', function (b) {
                if (b.keyCode == Event.KEY_RETURN) {
                    if (g.value.match(h)) {
                        var c = g.value.replace(h, '')
                    } else {
                        var c = g.value
                    };
                    switch (f[f.selectedIndex].value) {
                    case '>':
                        var d = '/users/' + c + '/dashboard';
                        break;
                    case '#':
                        var d = '/tags/' + c;
                        break;
                    case '^':
                        var d = 'http://' + c + '.blip.pl';
                        break
                    };
                    if (d) {
                        if(document.getElementById('jumpIntoNew').checked){
                            window.open(d, c);
                        }else{
                            window.location = d
                        }
                    }
                };
                if (g.value.match(h)) {
                    $A(f.options).each(function (a) {
                        if (g.value.startsWith(a.value)) {
                            a.selected = true
                        }
                    })
                }
            })
        });
    });

}, false);//*/


/*
blipera.settings.plugins.facebookSwitch = true;

// TODO: no idea why so many times executed
var zuo = false;
blipera.addStyle('div#content div#dashboard-input div#footline fieldset label { float: none; display: inline; width: auto; margin-left: 5px; }');
blipera.addEnhancement('facebookSwitch', function(){

    // checkboxes and wtf
    blipera.addEnhancement('facebookSwitchHelper', function(){
        if(!zuo){
            zuo = true;
        }else{
            return;
        }

        // append controls

        var recipientBox = document.getElementById('recipient-select');
        var l = recipientBox.getElementsByTagName('label')[0]
        recipientBox.removeChild(l);

        var element = document.createDocumentFragment();
        element.appendChild(
            document.createTextNode(':: ')
        );
        var check = document.createElement('input');
        check.setAttribute('type', 'checkbox');
        check.setAttribute('id', 'facebookSwitch');
        element.appendChild(check);

        var label = document.createElement('label');
        label.appendChild(
            document.createTextNode('+Facebook')
        );
        label.setAttribute('for', 'facebookSwitch');
        element.appendChild(label);//* /

        recipientBox.appendChild(element);
        element = null;

        blipera.facebookSwitch = document.getElementById('facebookSwitch');
        
        // listeners order
        
        document.getElementById('status-entry').addEventListener('keydown', function(e){
        if(e.ctrlKey && e.keyCode==13){
            
            document.getElementById('status-entry').value = document.getElementById('status-entry').value+' -ZUO';
        }
        
        }, true);
    }, true);
    
    


}, false);
*/

/*// evil magic
window.opera.addEventListener('BeforeEventListener.keydown', function (e){

    if(!blipera.facebookSwitch){
        return true;
    }
    
    if(e.event.ctrlKey){
        blipera.facebookSwitch.checked = true;
        
        
                
            };
            
     
    
}, false);

// evil magic
window.opera.addEventListener('BeforeEventListener.keyup', function (e){

    if(!blipera.facebookSwitch){
        return true;
    }

    if(!e.event.ctrlKey){
        blipera.facebookSwitch.checked = false;
    }

}, false);*/

blipera.settings.plugins.unreadCounter = true;
blipera.addPlugin('unreadCounter', function(){
    
    var icon = new Image();
    icon.src = document.getElementsByTagName('link')[3].href;
    
    var can = document.createElement('canvas');
    can.width = 16;
    can.height = 16;
    can.style.position = 'absolute';
    can.style.left = 0;
    can.style.top = 0;
    
    document.body.appendChild(can);
    
    var badge = function(count){
        
        
        
        var ctx = can.getContext('2d');
        ctx.drawImage(icon, 0, 0, 16, 16);
        ctx.fillRect(0, 7, 16, 9);
        
        if(count>0){
            //
        }
        
        /*document.getElementsByTagName('link')[3].href = can.toDataURL('image/png');*/
        
    }
    
    badge(0);
    
}, true);


addEventListener('DOMContentLoaded', function(){
    blipera.init();
}, false)