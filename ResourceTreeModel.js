/*
 * Copyright (C) 2011 Google Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *     * Neither the name of Google Inc. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */


WebInspector.ResourceTreeModel = function(networkManager)
{

    WebInspector.networkManager.addEventListener(WebInspector.NetworkManager.EventTypes.ResourceStarted, this._onResourceStarted, this);
    WebInspector.networkManager.addEventListener(WebInspector.NetworkManager.EventTypes.ResourceUpdated, this._onResourceUpdated, this);
    WebInspector.networkManager.addEventListener(WebInspector.NetworkManager.EventTypes.ResourceFinished, this._onResourceUpdated, this);
    WebInspector.networkManager.addEventListener(WebInspector.NetworkManager.EventTypes.FrameDetached, this._onFrameDetachedFromParent, this);
    WebInspector.networkManager.addEventListener(WebInspector.NetworkManager.EventTypes.FrameCommittedLoad, this._onCommitLoad, this);
    this.frontendReused();
}

WebInspector.ResourceTreeModel.EventTypes = {
    FrameAdded: "FrameAdded",
    FrameNavigated: "FrameNavigated",
    FrameDetached: "FrameDetached",
    ResourceAdded: "ResourceAdded",
    CachedResourcesLoaded: "CachedResourcesLoaded"
}

WebInspector.ResourceTreeModel.prototype = {
    frontendReused: function()
    {
        this._resourcesByURL = {};
        this._resourcesByFrameId = {};
        this._subframes = {};
        //NetworkAgent.getCachedResources(this._processCachedResources.bind(this));
    },

    _processCachedResources: function(error, mainFramePayload)
    {
        if (error)
            return;

        this.dispatchEventToListeners(WebInspector.ResourceTreeModel.EventTypes.FrameNavigated, 0);

        WebInspector.mainResource = this._addFramesRecursively(mainFramePayload);
        this._cachedResourcesProcessed = true;

        this.dispatchEventToListeners(WebInspector.ResourceTreeModel.EventTypes.CachedResourcesLoaded);
    },

    _addOrUpdateFrame: function(frame)
    {
        this.dispatchEventToListeners(WebInspector.ResourceTreeModel.EventTypes.FrameAdded, frame);

        var subframes = this._subframes[frame.parentId];
        if (!subframes) {
            subframes = [];
            this._subframes[frame.parentId || 0] = subframes;
        }
        subframes.push(frame);
    },

    frames: function(parentFrameId)
    {
        return this._subframes[parentFrameId] || [];
    },

    subframes: function(parentFrameId)
    {
        return this._subframes[parentFrameId] || [];
    },

    resources: function(frameId)
    {
        var result = [];
        var resources = this._resourcesByFrameId[frameId] || {};
        for (var url in resources)
            result.push(resources[url]);
        return result;
    },

    _onCommitLoad: function(event)
    {
        if (!this._cachedResourcesProcessed)
            return;

        var frame = event.data.frame;
        var loaderId = event.data.loaderId;
        var isMainFrame = !frame.parentId;

        // frame.parentId === 0 is when main frame navigation happens.
        this._clearChildFramesAndResources(isMainFrame ? 0 : frame.id, loaderId);

        this._addOrUpdateFrame(frame);

        var resourcesForFrame = this._resourcesByFrameId[frame.id];
        if (resourcesForFrame) {
            for (var url in resourcesForFrame)
                this.dispatchEventToListeners(WebInspector.ResourceTreeModel.EventTypes.ResourceAdded, resourcesForFrame[url]);
        }

        if (isMainFrame && this.resourceForURL(frame.url))
            WebInspector.mainResource = this.resourceForURL(frame.url);
    },

    _onFrameDetachedFromParent: function(event)
    {
        if (!this._cachedResourcesProcessed)
            return;

        var frameId = event.data;
        this._clearChildFramesAndResources(frameId, 0);
        this.dispatchEventToListeners(WebInspector.ResourceTreeModel.EventTypes.FrameDetached, frameId);
    },

    _onResourceStarted: function(event)
    {
        if (!this._cachedResourcesProcessed)
            return;
        this._bindResourceURL(event.data);
    },

    _onResourceUpdated: function(event)
    {
        if (!this._cachedResourcesProcessed)
            return;
        this._addResourceToFrame(event.data);
    },

    _addResourceToFrame: function(resource)
    {
        var frameId = resource.frameId;
        var resourcesForFrame = this._resourcesByFrameId[frameId];
        if (!resourcesForFrame) {
            resourcesForFrame = {};
            this._resourcesByFrameId[frameId] = resourcesForFrame;
        }
        if (resourcesForFrame[resource.url] === resource) {
            // Already in the tree, we just got an extra update.
            return;
        }

        resourcesForFrame[resource.url] = resource;
        this._bindResourceURL(resource);
        this.dispatchEventToListeners(WebInspector.ResourceTreeModel.EventTypes.ResourceAdded, resource);
    },

    forAllResources: function(callback)
    {
        this._callForFrameResources(0, callback);
    },

    addConsoleMessage: function(msg)
    {
        var resource = this.resourceForURL(msg.url);
        if (!resource)
            return;

        switch (msg.level) {
        case WebInspector.ConsoleMessage.MessageLevel.Warning:
            resource.warnings += msg.repeatDelta;
            break;
        case WebInspector.ConsoleMessage.MessageLevel.Error:
            resource.errors += msg.repeatDelta;
            break;
        }

        var view = WebInspector.ResourceView.resourceViewForResource(resource);
        if (view.addMessage && msg.isErrorOrWarning() && msg.message)
            view.addMessage(msg);
    },

    clearConsoleMessages: function()
    {
        function callback(resource)
        {
            resource.clearErrorsAndWarnings();
        }
        this.forAllResources(callback);
    },

    resourceForURL: function(url)
    {
        return this._resourcesByURL[url];
    },

    _bindResourceURL: function(resource)
    {
        this._resourcesByURL[resource.url] = resource;
    },

    _clearChildFramesAndResources: function(frameId, loaderToPreserveId)
    {
        this.dispatchEventToListeners(WebInspector.ResourceTreeModel.EventTypes.FrameNavigated, frameId);

        this._clearResources(frameId, loaderToPreserveId);
        var subframes = this._subframes[frameId];
        for (var i = 0; subframes && i < subframes.length; ++ i) {
            this.dispatchEventToListeners(WebInspector.ResourceTreeModel.EventTypes.FrameRemoved, subframes[i].id);
            this._clearChildFramesAndResources(subframes[i].id, loaderToPreserveId);
        }
        delete this._subframes[frameId];
    },

    _clearResources: function(frameId, loaderToPreserveId)
    {
        var resourcesForFrame = this._resourcesByFrameId[frameId];
        if (!resourcesForFrame)
            return;

        var preservedResourcesForFrame = [];
        for (var url in resourcesForFrame) {
            var resource = resourcesForFrame[url];
            if (resource.loaderId === loaderToPreserveId) {
                preservedResourcesForFrame[url] = resource;
                continue;
            }
            this._unbindResourceURL(resource);
        }

        delete this._resourcesByFrameId[frameId];
        if (preservedResourcesForFrame.length) {
            this._resourcesByFrameId[frameId] = preservedResourcesForFrame;
        }
    },

    _callForFrameResources: function(frameId, callback)
    {
        var resources = this._resourcesByFrameId[frameId];

        for (var url in resources) {
            if (callback(resources[url]))
                return true;
        }
        
        var frames = this._subframes[frameId];
        for (var i = 0; frames && i < frames.length; ++i) {
            if (this._callForFrameResources(frames[i].id, callback))
                return true;
        }
        return false;
    },

    _unbindResourceURL: function(resource)
    {
        delete this._resourcesByURL[resource.url];
    },

    _addFramesRecursively: function(frameTreePayload)
    {
        var framePayload = frameTreePayload.frame;

        // Create frame resource.
        var frameResource = this._createResource(framePayload, framePayload.url);
        frameResource.type = WebInspector.Resource.Type.Document;
        frameResource.finished = true;

        this._addOrUpdateFrame(framePayload);
        this._addResourceToFrame(frameResource);

        for (var i = 0; frameTreePayload.childFrames && i < frameTreePayload.childFrames.length; ++i)
            this._addFramesRecursively(frameTreePayload.childFrames[i]);

        if (!frameTreePayload.resources)
            return;

        // Create frame subresources.
        for (var i = 0; i < frameTreePayload.resources.length; ++i) {
            var subresource = frameTreePayload.resources[i];
            var resource = this._createResource(framePayload, subresource.url);
            resource.type = WebInspector.Resource.Type[subresource.type];
            resource.finished = true;
            this._addResourceToFrame(resource);
        }
        return frameResource;
    },

    _createResource: function(frame, url)
    {
        var resource = new WebInspector.Resource(null, url);
        resource.frameId = frame.id;
        resource.loaderId = frame.loaderId;
        resource.documentURL = frame.url;
        return resource;
    }
}

WebInspector.ResourceTreeModel.prototype.__proto__ = WebInspector.Object.prototype;
