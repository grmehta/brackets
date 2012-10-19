/*
 * Copyright (c) 2012 Adobe Systems Incorporated. All rights reserved.
 *  
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"), 
 * to deal in the Software without restriction, including without limitation 
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the 
 * Software is furnished to do so, subject to the following conditions:
 *  
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *  
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
 * DEALINGS IN THE SOFTWARE.
 * 
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, window */

/**
 * Resizer is a Module utility to inject resizing capabilities to any element
 * inside Brackets.
 * 
 * On initialization, Resizer discovers all nodes tagged as "vert-resizable" 
 * and "horz-resizable" to add the resizer handler. Additionally, "top-resizer", 
 * "bottom-resizer", "left-resizer" and "right-resizer" classes control the 
 * position of the resizer on the element.
 *
 * An element can be made resizable at any time using the `makeResizable` API
 *
 * The resizable elements trigger a panelResizeStart, panelResizeUpdate and panelResizeEnd
 * event that can be used to create performance optimizations (such as hiding/showing elements 
 * while resizing), custom or internal resizes and save the final resized value into local 
 * storage for example.
 *
 * A resizable element can be collapsed/expanded using the `show`, `hide` and `toggle` APIs
 *
 * The resizable elements trigger a panelCollapsed and panelExpanded event when the panel toggles
 * between visible and invisible
 */
define(function (require, exports, module) {
    "use strict";

    var DIRECTION_VERTICAL = "vert";
    var DIRECTION_HORIZONTAL = "horz";
    
    var POSITION_TOP = "top";
    var POSITION_BOTTOM = "bottom";
    var POSITION_LEFT = "left";
    var POSITION_RIGHT = "right";
    
    // Minimum size (height or width) for autodiscovered resizable panels
    var DEFAULT_MIN_SIZE = 100;
    
    // Load dependent modules
    var AppInit                 = require("utils/AppInit"),
        EditorManager           = require("editor/EditorManager");
    
    var $mainView;
    
    /**
     * Shows a resizable element.
     * @param {DOMNode} element Html element to show if possible
     */
    function show(element) {
        var showFunc = $(element).data("show");
        if (showFunc) {
            showFunc.apply(element);
        }
    }
    
    /**
     * Hides a resizable element.
     * @param {DOMNode} element Html element to hide if possible
     */
    function hide(element) {
        var hideFunc = $(element).data("hide");
        if (hideFunc) {
            hideFunc.apply(element);
        }
    }
    
    /**
     * Changes the visibility state of a resizable element. The toggle
     * functionality is added when an element is made resizable.
     * @param {DOMNode} element Html element to toggle
     */
    function toggle(element) {
        if ($(element).is(":visible")) {
            hide(element);
        } else {
            show(element);
        }
    }
    
    /**
     * Adds resizing capabilities to a given html element.
     *
     * Resizing can be configured in two directions:
     *  - Vertical ("vert"): Resizes the height of the element
     *  - Horizontal ("horz"): Resizes the width of the element
     *
     * Resizer handlers can be positioned on the element at:
     *  - Top ("top") or bottom ("bottom") for vertical resizing
     *  - Left ("left") or right ("right") for horizontal resizing
     *
     * A resizable element triggers the following events while resizing:
     *  - panelResizeStart: When the resize starts
     *  - panelResizeUpdate: When the resize gets updated
     *  - panelResizeEnds: When the resize ends
     *  - panelCollapsed: When the panel gets collapsed (or hidden)
     *  - panelExpanded: When the panel gets expanded (or shown)     
     *
     * @param {DOMNode} element Html element which should be made resizable.
     * @param {string} direction The direction of the resize action. Must be "horz" or "vert".
     * @param {string} position The position of the resizer on the element. Can be "top" or "bottom"
     *                          for vertical resizing and "left" or "right" for horizontal resizing.
     * @param {int} minSize Minimum size (width or height) of the element.
     * @param {boolean} collapsable True indicates the panel is collapsable on double click
     *                              on the resizer.
     */
    function makeResizable(element, direction, position, minSize, collapsable) {
        
        var $resizer            = $('<div class="' + direction + '-resizer"></div>'),
            $element            = $(element),
            $resizableElement   = $($element.find(".resizable-content:first")[0]),
            $body               = $(window.document.body),
            animationRequest    = null,
            directionProperty   = direction === DIRECTION_HORIZONTAL ? "clientX" : "clientY",
            elementSizeFunction = direction === DIRECTION_HORIZONTAL ? $element.width : $element.height,
            resizerCSSPosition  = direction === DIRECTION_HORIZONTAL ? "left" : "top",
            contentSizeFunction = null;
                
        minSize = minSize || 0;
        collapsable = collapsable || false;
            
        $element.prepend($resizer);
        
        $element.data("show", function () {
            $element.show();
            
            if (collapsable) {
                $element.prepend($resizer);
                $resizer.css(resizerCSSPosition, "");
            }
            
            EditorManager.resizeEditor();
            $element.trigger("panelExpanded");
        });
                      
        $element.data("hide", function () {
            var elementOffset   = $element.offset(),
                elementSize     = elementSizeFunction.apply($element);
            
            $element.hide();
            if (collapsable) {
                $resizer.insertBefore($element).css(resizerCSSPosition, elementOffset[resizerCSSPosition] + elementSize);
            }
            
            EditorManager.resizeEditor();
            $element.trigger("panelCollapsed");
        });
    
        $resizer.on("mousedown", function (e) {
            var $resizeCont     = $("<div class='resizing-container " + direction + "-resizing' />"),
                startPosition   = e[directionProperty],
                startSize       = $element.is(":visible") ? elementSizeFunction.apply($element) : 0,
                newSize         = startSize,
                baseSize        = 0,
                doResize        = false,
                isMouseDown     = true;
            
            $body.append($resizeCont);
            
            $element.trigger("panelResizeStart", [elementSizeFunction.apply($element)]);
            
            if ($resizableElement !== undefined) {
                $element.children().not(".horz-resizer, .vert-resizer, .resizable-content").each(function (index, child) {
                    if (direction === DIRECTION_HORIZONTAL) {
                        baseSize += $(child).outerWidth();
                    } else {
                        baseSize += $(child).outerHeight();
                    }
                });
                
                contentSizeFunction = direction === DIRECTION_HORIZONTAL ? $resizableElement.width : $resizableElement.height;
            }
                        
            animationRequest = window.webkitRequestAnimationFrame(function doRedraw() {
                // only run this if the mouse is down so we don't constantly loop even 
                // after we're done resizing.
                if (!isMouseDown) {
                    return;
                }
                
                if (doResize) {
                    // resize the main element to the new size
                    if ($element.is(":visible")) {
                        elementSizeFunction.apply($element, [newSize]);
                        
                        // if there is a content element, its size is the new size
                        // minus the size of the non-resizable elements
                        if ($resizableElement !== undefined) {
                            contentSizeFunction.apply($resizableElement, [newSize - baseSize]);
                        }
                    
                        if (newSize < 10) {
                            toggle($element);
                        }
                    } else if (newSize > 10) {
                        elementSizeFunction.apply($element, [newSize]);
                        toggle($element);
                        $element.trigger("panelResizeStart", [elementSizeFunction.apply($element)]);
                    }
    
                    EditorManager.resizeEditor();
                }
                
                animationRequest = window.webkitRequestAnimationFrame(doRedraw);
            });
            
            $resizeCont.on("mousemove", function (e) {
                doResize = true;
                // calculate newSize adding to startSize the difference
                // between starting and current position, capped at minSize
                newSize = Math.max(startSize + (startPosition - e[directionProperty]), minSize);
                $element.trigger("panelResizeUpdate", [newSize]);
                e.preventDefault();
            });
            
            // If the element is marked as collapsable, check for double click
            // to toggle the element visibility
            if (collapsable) {
                $resizeCont.on("mousedown", function (e) {
                    toggle($element);
                });
            }
            
            function endResize(e) {
                if (isMouseDown) {
                    isMouseDown = false;
                    $element.trigger("panelResizeEnd", [elementSizeFunction.apply($element)]);
                    
                    // We wait 100ms to remove the resizer container to capture a mousedown
                    // on the container that would account for double click
                    window.setTimeout(function () {
                        $resizeCont.off("mousemove");
                        $resizeCont.off("mousedown");
                        $resizeCont.remove();
                    }, 100);
                }
            }
            
            $resizeCont.one("mouseup", endResize);
            $resizeCont.mouseleave(endResize);
            
            e.preventDefault();
        });
    }
    
    // Scan DOM for horz-resizable and vert-resizable classes and make them resizable
    AppInit.htmlReady(function () {
        $mainView = $(".main-view");
        
        $(".vert-resizable").each(function (index, element) {
            
            if ($(element).hasClass("top-resizer")) {
                makeResizable(element, DIRECTION_VERTICAL, POSITION_TOP, DEFAULT_MIN_SIZE, $(element).hasClass("collapsable"));
            }
            
            //if ($(element).hasClass("bottom-resizer")) {
            //    makeResizable(element, DIRECTION_VERTICAL, POSITION_BOTTOM, DEFAULT_MIN_SIZE);
            //}
        });
        
        $(".horz-resizable").each(function (index, element) {
            
            //if ($(element).hasClass("left-resizer")) {
            //    makeResizable(element, DIRECTION_HORIZONTAL, POSITION_LEFT, DEFAULT_MIN_SIZE);
            //}

            //if ($(element).hasClass("right-resizer")) {
            //    makeResizable(element, DIRECTION_HORIZONTAL, POSITION_RIGHT, DEFAULT_MIN_SIZE);
            //}
        });
    });
    
    exports.makeResizable = makeResizable;
    exports.toggle = toggle;
    exports.show = show;
    exports.hide = hide;
});