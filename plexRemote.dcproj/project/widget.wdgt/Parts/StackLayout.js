/*jsl:import DashcodePart.js*/

/**   
 *  @declare DC.StackLayout
 *  @extends DC.DashcodePart
 *  
 */
 
// Public properties:
//    startTransitionCallback: function to call when a transition will start
//        The callback function will receive 3 parameters: (stackLayout, oldView, newView)
//            stackLayout: The stackLayout object that will perform the transition
//            oldView: The current view element before the transition
//            newView: The view element that will be active after the transition
//    endTransitionCallback: function to call when a transition did end
//        The callback function will receive 3 parameters: (stackLayout, oldView, newView)
//            stackLayout: The stackLayout object that performed the transition
//            oldView: The view element that was active before the transition
//            newView: The new current view element
//
// Public Methods:
//    getAllViews(): returns an array of all the stack layout view elements.
//    getCurrentView(): returns the currently visible view element.
//    setCurrentView(newView, isReverse, makeTopVisible): make newView the visible view, using the specified transition. 
//        newView: the id of the view DOM element or the DOM element itself.
//        isReverse (optional): perform the transition in reverse
//        makeTopVisible (optional): true to scroll to the top of the page before the transition
//    getTransitionForView(view): return the transition object assigned to view.
//
// Note: Properties and methods beginning with underbar ("_") are considered private and subject to change in future Dashcode releases.


DC.StackLayout= Class.create(DC.DashcodePart, {

    __viewClassName__: "StackLayout",

    exposedBindings: ["currentView"],
        
    clonedFrom: function(originalView){
        this.base(originalView);
        
        // when cloning template, get style from original
        this._viewsOldOpacity = originalView._viewsOldOpacity;        
    },
    
    partSetup: function(spec)
    {
        this.base(spec);
        
        var subviewsTransitions = spec.subviewsTransitions || [];
        var element = this.viewElement();
        
        var originalID = spec.originalID ? spec.originalID : element.originalID;
        this._viewsOldOpacity = [];
    
        this._views = [];
        this._currentView = null;
        var kids = element.children;
        this._inDesign = window.dashcode && window.dashcode.inDesign;
        var firstElementDone = false;
        for (var i=0; i<kids.length; i++) {
            var view = kids[i];
            this._views.push(view);
            // Doing this only during runtime since we don't want any of the settings to end up in the files during design time. Also, design time view swapping is done differently.
            if (!this._inDesign && !originalID) {
                view.style.display = (firstElementDone) ? 'none' : 'block';
                // Remember the previous inline opacity because we make use of it for dissolve/fade transitions
                if (this._viewsOldOpacity.length <= i) {
                    this._viewsOldOpacity.push(view.style.opacity);
                }
                view.style.opacity = (firstElementDone) ? 0 : 1;
                firstElementDone = true;
            }
        }
    
        if (this._views.length > 0) {
            this._viewsTransition = [];
            this.setCurrentView(this._views[0]);
            
            if (this._views.length == subviewsTransitions.length) {
                for (var i=0; i<this._views.length; i++) {
                    this._viewsTransition[i] = CreateTransitionWithProperties(subviewsTransitions[i]);
                }
            }
        }
    
        // StackLayout is usually pretty shallow from <body>
        this._topPosFromBody = 0;
        var curElement = this.viewElement();
        do {
            this._topPosFromBody += curElement.offsetTop;
        } while (curElement = curElement.offsetParent);
        
        this._maskContainerElement = element; // default
    },
    
    getAllViews:  function()
    {
        return this._views;
    },
    
    getCurrentView:  function()
    {
        return this._currentView;
    },
    
    // The bindings requires the setter to have 1 argument
    // argument 2 and 3 are optional, so we need to wrap
    // this up. Existing clients should still work
    setCurrentView: function(newView)
    {
        this.setCurrentViewWrapped(newView,arguments[1],arguments[2]);
    },
    
    setCurrentViewWrapped:  function(newView, isReverse, makeTopVisible)
    {
        // Look up by id if necessary
        newView = this._getView(newView);
        var oldView = this.getCurrentView();
        
        if (!newView || (oldView == newView)) {
            return;
        }
        
        // Make sure the view is ours
        if (!newView.parentNode == this.viewElement()) {
            return;
        }
        
        var transition = this._viewsTransition[this._indexOfView(newView)];
        if (!transition) transition = new Transition(Transition.NONE_TYPE);
        
        if (oldView) {
            if (isReverse) {
                transition = this._viewsTransition[this._indexOfView(oldView)];
            }
        }
        
        this._setCurrentViewPrimitive(newView, oldView, transition, isReverse, makeTopVisible);
    },
    
    setCurrentViewWithTransition:  function(newView, transition, isReverse, makeTopVisible)
    {
        // Look up by id if necessary
        newView = this._getView(newView);
        if (!newView) {
            return;
        }
        
        // Make sure the view is ours
        if (!newView.parentNode == this.viewElement()) {
            return;
        }
        var oldView = this.getCurrentView();
        
        this._setCurrentViewPrimitive(newView, oldView, transition, isReverse, makeTopVisible);
    },
    
    getTransitionForView:  function(view)
    {
        // Look up by id if necessary
        view = this._getView(view);
        return this._viewsTransition[this._indexOfView(view)];
    },
    
    addView:  function(viewElement, transition) 
    {
        this._views.push(viewElement);
        this._viewsOldOpacity.push(viewElement.style.opacity);
        viewElement.style.opacity = (this._views.length == 1 ? 1 : 0);
        viewElement.style.display = (this._views.length == 1 ? 'none' : 'block');
        viewElement.style.webkitTransform = 'translate(0px, 0px)';
        if (!transition) {
            transition = null;
            //transition = new Transition(Transition.NONE_TYPE, 0, Transition.EASE_TIMING)
        }
        this._viewsTransition[this._views.length - 1] = transition;
        this.viewElement().appendChild(viewElement);
        
        if (this._views.length == 1) {
            this.setCurrentView(viewElement);
        }
    },
    
    removeView:  function(viewElement) 
    {
        var viewIndex = this._indexOfView(viewElement);
        if ((viewIndex < 0) || (this._views.length == 1)) {
            return;
        }
        if (viewElement == this.getCurrentView()) {
            this.setCurrentView(this._views[(viewIndex == 0 ? 1 : 0)]);
        }
        this._views.splice(viewIndex, 1);
        this._viewsOldOpacity.splice(viewIndex, 1);
        this._viewsTransition.splice(viewIndex, 1);
        this.viewElement().removeChild(viewElement);
    },
    
    _indexOfView:  function(view)
    {
        var index = -1;
        if (this._views.indexOf) {
            index = this._views.indexOf(view);
        }
        else {
            // Tiger's Dashboard doesn't have indexOf for array
            for (var i=0; i<this._views.length; i++) {
                if (this._views[i] == view) {
                    index = i;
                    break;
                }
            }
        }
        return index;
    },
    
    _getView:  function(view)
    {
        if (view) {
            if (view.nodeType == 1/*Node.ELEMENT_NODE*/) {
                // Already an element
                return view;
            }
            if (view.element) {
                // It's a part object
                return view.element;
            }
            
            // Check our children views
            for(var i = 0; i < this._views.length; i++) {
                var child = this._views[i];
                
                if ((child.id == view) || (child.originalID == view)){
                    return child;
                }
            }
        }
        return null;
    },
    
    _setRestrictToBrowserTransition:  function(restrictFlag)
    {
        this._restrictedBrowserTransition = restrictFlag ? CreateTransitionWithProperties( {'type' : Transition.PUSH_TYPE, 'direction' : Transition.RIGHT_TO_LEFT_DIRECTION, 'timing' : Transition.EASE_IN_OUT_TIMING} ) : null;
    },
    
    _getRealTransition:  function(transition)
    {
        var realTransition = transition;
        if (this._restrictedBrowserTransition) {
            // Note that we are not making a copy of it, mainly for performance reason on the device.
            realTransition = this._restrictedBrowserTransition;
            realTransition.setDuration(transition.getDuration());
        }
        return realTransition;
    },
    
    _setCurrentViewPrimitive:  function(newView, oldView, transition, isReverse, makeTopVisible)
    {
        // newView must be the element now and all error checking has been done.
        
        // View swapping in design time is done in application. Also, we want to be very careful about performing transition during design time because the attributes that get added during the transition into the DOM will get persisted into the HTML during regeneration.
        if (!this._inDesign) {
            // call the public start transition callback
            if (this.startTransitionCallback) {
                this.startTransitionCallback(this, oldView, newView);
            }
            
            if (makeTopVisible) {
                var scrollY = this._topPosFromBody - window.pageYOffset;
                if (scrollY < 0) {
                    window.scrollBy(0, scrollY);
                }
            }
            
            if (DC.page.focusedElement){
                DC.page.focusedElement.blur();
            }
            
            if (transition) {
                this._restoreOldOpacity(oldView);
                this._restoreOldOpacity(newView);
                
                var realTransition = this._getRealTransition(transition);

                // register transition end callbacks
                var self = this;
                realTransition._privateEndTransitionCallback = function(transition) {
                    self._transitionEnded(transition, oldView, newView);
                }
                
                realTransition._maskContainerElement = this._maskContainerElement;
                realTransition.perform(newView, oldView, isReverse);
            }
            else {
                if (oldView) oldView.style.display = 'none';
                if (newView) {
                    newView.style.display = 'block';
                    this._restoreOldOpacity(newView);
                }
                this._transitionEnded(null, oldView, newView);
            }
        }
        
        this._currentView = newView;
    },
    
    _transitionEnded:  function(transition, oldView, newView)
    {
        // if specified, call the private and public end transition callbacks
        if (this._privateEndTransitionCallback) {
            this._privateEndTransitionCallback(this, oldView, newView);
        }
        if (this.endTransitionCallback) {
            this.endTransitionCallback(this, oldView, newView);
        }
    },

    // Restore previous inline opacity
    _restoreOldOpacity:  function(view)
    {
        if (view) {
            var oldOpacity = this._viewsOldOpacity[this._indexOfView(view)];
            view.style.opacity = (oldOpacity !== undefined) ? oldOpacity : null;
        }
    }

});