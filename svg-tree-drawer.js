/**
 * SVG Tree Drawer
 * by Weston Ruter
 *
 * Initially built for Syntax Tree Diagrammer
 * @todo We need to be able to define different style for the leaf nodes.
 * @todo branchHeight, labelPadding
 * @todo Implement collapsing
 * @todo Work up a condensed datastructure?
 * @todo Stylesheet should be named? Or when we serialize, we can just get all of the rules from all of the stylesheets.
 * @todo Try disabling native support (use the OBJECT); and try forcing Flash to see if it'll work in IE
 * @todo Publicize on MozHacks: SVG + MathML + ContentEditable + hashchange + JSON.parse/stringify
 */
(function(){
if(typeof TreeDrawer != 'undefined')
	return;

var svgns = 'http://www.w3.org/2000/svg';
var xlinkns = 'http://www.w3.org/1999/xlink';

/**
 * Class that is associated with a given SVG element and contains methods and
 * properties that relate to the tree as a whole.
 */
var T = window.TreeDrawer = function(svgContainerElement, treeData){
	if(typeof svgContainerElement == 'string')
		svgContainerElement = document.getElementById(svgContainerElement);
	if(!svgContainerElement || !svgContainerElement.nodeType == 1)
		throw Error("The param 'svgContainerElement' is not valid.");
	
	var isNativeSVG = !!document.createElementNS(svgns, 'text').getComputedTextLength;
	
	// Create the SVG document
	if(isNativeSVG){
		var svg = document.createElementNS(svgns, 'svg');
		svg.setAttribute('width', 0);
		svg.setAttribute('height', 0);
		svgContainerElement.appendChild(svg);
		this.svgElement = svg;
		
		// Add the stylesheet
		var defs = document.createElementNS(svgns, 'defs');
		var style = document.createElementNS(svgns, 'style');
		style.setAttribute('type', 'text/css');
		//style.appendChild(document.createTextNode(this.cssStylesheet));
		defs.appendChild(style);
		this.svgElement.appendChild(defs);
		style.appendChild(document.createTextNode(this.cssStylesheet))
		//for(var i = 0, len = this.cssStyleRules.length; i < len; i++){
			//style.sheet.insertRule(this.cssStyleRules[i], i);
			//console.info(this.cssStyleRules[i])
		//}
		
		if(treeData)
			this.populate(treeData);
	}
	// Utilize svgweb
	else {
		if(typeof svgweb == 'undefined')
			throw Error("Requires the use of svgweb");
		
		var obj = document.createElement('object', true);
		obj.setAttribute('type', 'image/svg+xml');
		//obj.setAttribute('data', 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"></svg>');
		obj.setAttribute('data', 'blank.svg');
		obj.setAttribute('width', 0);
		obj.setAttribute('height', 0);
		this.svgObject = obj;
		var that = this;
		obj.addEventListener('load', function(e){
			try{
				that.svgDocument = this.contentDocument;
				that.svgElement = that.svgDocument.documentElement;
			
				// Add the stylesheet
				var defs = document.createElementNS(svgns, 'defs');
				var style = document.createElementNS(svgns, 'style');
				style.setAttribute('type', 'text/css');
				style.appendChild(document.createTextNode(that.cssStylesheet));
				
				defs.appendChild(style);
				//that.svgElement.appendChild(defs); //TODO
				
				if(treeData)
					that.populate(treeData);
			}
			catch(e){
				console.error(e)
			}
		}, false);
		svgweb.appendChild(obj, svgContainerElement);
	}
};

T.prototype.svgDocument = null; //readonly (only set when using svgweb)
T.prototype.svgObject = null; //readonly (only set when using svgweb)
T.prototype.svgElement = null; //readonly
//T.prototype.collapsed = false; //readonly
T.prototype.width = 0; //readonly
T.prototype.height = 0; //readonly

//T.prototype.cssStylesheet = 'line, path { dominant-baseline:middle; }';
T.prototype.cssStylesheet = [
	"line, path { stroke-width:2px; stroke:black; }",
	"text { dominant-baseline:text-after-edge !important; }",
	"svg {font-size:20px; }",
	//"svg > g > g > text { font-size:120px; }"
].join("\n");
T.prototype.labelPadding = '10px';
T.prototype.branchHeight = '30px';

/**
 * The root TreeDrawer.Node
 */
T.prototype.root = null;


/**
 * Empty the tree
 */
T.prototype.empty = function empty(){
	var svg = this.svgElement;
	//while(svg.firstChild){
	//	svg.parentNode.removeChild(svg.firstChild)
	//}
	for(var i = 0; i < svg.childNodes.length; i++){
		if(svg.childNodes[i].nodeName.toLowerCase() == 'g'){
			svg.removeChild(svg.childNodes[i]);
			i--;
		}
	}
	
	this.width = 0;
	this.height = 0;
	if(this.svgObject){
		this.svgObject.width = this.width;
		this.svgObject.height = this.height;
	}
	else {
		this.svgElement.setAttribute('width', this.width);
		this.svgElement.setAttribute('height', this.height);
	}
}


/**
 * Renders the tree onto the SVG canvas, resizing the canvas as necessary
 * This function does the heavy lifting of the code
 * @see _drawNode()
	* @todo All CSS should be specified in CSS as much as possible. Only labelPadding and branchHeight are non-CSS
 */
T.prototype.draw = function draw(){
	this.empty();
	
	var fontSize = parseFloat(window.getComputedStyle(this.svgElement, null).fontSize);
	
	var labelPadding = parsePixels(this.labelPadding, fontSize);
	var branchHeight = parsePixels(this.branchHeight, fontSize);
	var info = _drawNode(this, this.svgElement, this.root, 0, 0, labelPadding, branchHeight);
	
	/*var t = document.createElementNS(svgns,'text');
	t.appendChild(document.createTextNode('NʃP'))
	t.setAttribute('x', '10px');
	t.setAttribute('y', '0');
	t.setAttribute('style', 'font-size:120px;');
	this.svgElement.appendChild(t);
	console.info(t.getBoundingClientRect())*/
	
	if(this.svgObject){
		this.svgObject.width = this.width;
		this.svgObject.height = this.height;
	}
	else {
		this.svgElement.setAttribute('width', this.width);
		this.svgElement.setAttribute('height', this.height);
	}
};


/**
 * Parse a CSS unit from the fontSize
 */
function parsePixels(value, fontSize, inheritedValue){
	if(value.toLowerCase() == 'inherit')
		return inheritedValue;
	var matches = value.toString().match(/(\d+\.?\d*)(\w*)/);
	if(!matches)
		throw Error("Unable to parse CSS value: " + value);
	var unit = matches[2] || 'px';
	var number = parseFloat(matches[1]);
	
	switch(unit){
		case 'px':
			return number;
		case 'em':
			return number * fontSize;
		default:
			throw Error('Unimplemented CSS unit: ' + unit);
	}
	return null;
}

//console.info(parsePixelsFromCSSUnit( 'inherit', null, 20));

/**
 * Recursive function called by TreeDrawer.draw()
 * @param offsetTop The distance from the top to the bottom of the lower end of the branches
 * @todo In Firefox <3 getBoundingClientRect doesn't include width and height
 */
function _drawNode(tree, parentElement, treeNode, offsetLeft, offsetTop, inheritedLabelPadding, inheritedBranchHeight){
	//Make label
	var label = document.createElementNS(svgns, 'text');
	label.appendChild(document.createTextNode(treeNode.label, true));
	
	//Make container (not really necessary, but aids readibility of DOM)
	var g = document.createElementNS(svgns, 'g');
	g.appendChild(label);
	parentElement.appendChild(g);
	
	//Create branch which will connect this label with the parent label
	var branch;
	if(parentElement.localName != 'svg'){
		branch = document.createElementNS(svgns, 'line');
		g.appendChild(branch);
	}
	
	//Get styles and dimensions
	var labelStyle = window.getComputedStyle(label, null);
	var labelFontSize = parseFloat(labelStyle.fontSize);
	var labelPadding = parsePixels(treeNode.labelPadding, labelFontSize, inheritedLabelPadding);
	//var gStyle = window.getComputedStyle(g, null);
	//var gFontSize = parseFloat(gStyle.fontSize);
	var branchHeight = parsePixels(treeNode.branchHeight, labelFontSize, inheritedBranchHeight);
	//var labelRect = label.getBoundingClientRect(); //TODO: If doesn't include height, then calculate the height
	//if(!labelRect.width)
	//	labelRect.width = label.getComputedTextLength(); //labelRect.right - labelRect.left;
	//if(!labelRect.height)
	//	labelRect.height = labelFontSize; //labelRect.bottom - labelRect.top;
	var labelRect = {width:label.getComputedTextLength(),height:labelFontSize};
	
	//if(treeNode.label == 'NʃP'){
	//	console.warn(labelRect)
	//}
	
	//Process each of the children
	var childrenWidth = 0;
	var childrenInfo = [];
	for(var i = 0, len = treeNode.children.length; i < len; i++){
		var childInfo = _drawNode(
			tree,
			g,
			treeNode.children[i],
			offsetLeft+childrenWidth,
			offsetTop + labelPadding /* top */
			          + labelRect.height
					  + labelPadding /* bottom */
					  + branchHeight,
			//offsetTop + labelPadding + labelFontSize + labelPadding, //parentLabelBottom
			labelPadding, //inherit
			branchHeight //inherit
		);
		childrenWidth += childInfo.width;
		childrenInfo.push(childInfo);
		//childrenHeight = Math.max(childrenMaxHeight, childInfo.height);
	}
	
	//Get coordinates for label and position
	var labelY = offsetTop + labelPadding; //labelRect.height; //labelStyle.textAnchor
	if(label.nodeName == 'text')
		labelY += labelFontSize; //labelRect.height;
	//console.info([treeNode.label, offsetTop, labelPadding, labelRect.height])
	var labelX;
	//If there are children, then x is in the middle of their first and last children
	//TODO: if labelWidth > childrenWidth, we could pass in the labelWidth
	if(childrenInfo.length){
		var firstChildLabel = childrenInfo[0].label;
		var lastChildLabel = childrenInfo[childrenInfo.length-1].label;
		var leftX = parseFloat(firstChildLabel.getAttribute('x')) + firstChildLabel.getComputedTextLength()/2;
		var rightX = parseFloat(lastChildLabel.getAttribute('x')) + lastChildLabel.getComputedTextLength()/2;
		labelX = leftX + (rightX - leftX)/2 - labelRect.width/2;
	}
	//No children, so left edge is simply offsetLeft
	else {
		labelX = offsetLeft + labelPadding /*left*/;
	}
	labelX = Math.max(0, labelX); //Make sure that parent labels which are wider than their children don't get placed outside of viewbox
	label.setAttribute('x', labelX + 'px');
	label.setAttribute('y', labelY + 'px');
	
	//Draw rect around label
	//var rect = document.createElementNS(svgns, 'rect');
	//rect.setAttribute('style', 'stroke:blue; stroke-width:1px; fill:none;');
	//rect.setAttribute('x', labelX + 'px');
	//rect.setAttribute('y', (labelY-labelFontSize) + 'px');
	//rect.setAttribute('width', labelRect.width + 'px');
	//rect.setAttribute('height', labelRect.height + 'px');
	//g.appendChild(rect);
	

	var rect = document.createElementNS(svgns, 'rect');
	rect.setAttribute('style', 'stroke:blue; stroke-width:1px; fill:none;');
	rect.setAttribute('x', labelX + 'px');
	rect.setAttribute('y', (labelY-labelFontSize) + 'px');
	rect.setAttribute('width', labelRect.width + 'px');
	rect.setAttribute('height', labelRect.height + 'px');
	g.appendChild(rect);
	
	
	//Position branch directly above the label
	if(branch){
		branch.setAttribute('x2', labelX + labelRect.width/2  + 'px');
		branch.setAttribute('y2', offsetTop + 'px');
	}
	
	//Connect branches from child labels to parent label
	for(var i = 0, len = childrenInfo.length; i < len; i++){
		childrenInfo[i].branch.setAttribute('x1', labelX + labelRect.width/2 + 'px');
		childrenInfo[i].branch.setAttribute('y1', offsetTop + labelPadding*2 + labelRect.height + 'px');
	}

	//Update the dimensions of the entire "canvas"
	tree.height = Math.max(
		tree.height,
		offsetTop + labelPadding/*top*/ + labelRect.height + labelPadding/*bottom*/
	);
	tree.width = Math.max(
		tree.width,
		offsetLeft + childrenWidth,
		offsetLeft + labelRect.width + labelPadding*2,
		labelX + labelRect.width + labelPadding*2
	);
	
	return {
		label:label,
		branch:branch,
		width:Math.max(labelRect.width+labelPadding*2, childrenWidth)
	};
}


/**
 * Populate the SVG tree with data, overriding the existing data
 * @param {object} treeData  A instance of TreeDrawer.Node
 */
T.prototype.populate = function populate(treeNode){
	if(treeNode instanceof TN)
		this.root = treeNode;
	else
		this.root = new TN(treeNode);
	this.draw();
};


/**
 * Class that represents a node in a tree
 */
var TN = T.Node = function(obj){
	this.label = obj.label;
	this.collapsed = !!obj.collapsed;
	if(obj.children && obj.children.length){
		this.children = [];
		for(var i = 0, len = obj.children.length; i < len; i++){
			this.children.push(new TN(obj.children[i]));
		}
	}
};
TN.prototype.label = "";
TN.prototype.collapsed = false;
TN.prototype.children = [];
TN.prototype.labelPadding = 'inherit';
TN.prototype.branchHeight = 'inherit';


/**
 * If the node is collapsed, then expand it and draw.
 */
TN.prototype.expand = function expand(){
	if(!this.collapsed)
		return;
	this.collapsed = false;
	this.draw();
};


/**
 * If the node is expanded, then collapse it and draw.
 */
TN.prototype.collapse = function collapse(){
	if(this.collapsed)
		return;
	this.collapsed = true;
	this.draw();
};



/*
1. Convert SVG to Canvas via standard canvas API informed by positions and dimensions 
   available from SVG? Note Canvas has a measureText() method. 
   http://uupaa-js-spinoff.googlecode.com/svn/trunk/uupaa-excanvas.js/demo/8_2_canvas_measureText.html
2. Do SVG and the have a button to export to Canvas, which will iterate over all of the
   elements in the SVG document and draw them onto a corresponding canvas element.


 
 
NOTE: Must be valid JSON, otherwise someone could inject some bad JavaScript in a bad URL
QUESTION: Can we do Packer without the self-extraction code included? We can do a JavaScript implementation of GZip and then store result in hash after Base64


*/

})();

