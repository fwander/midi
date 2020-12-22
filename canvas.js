window.AudioContext = window.AudioContext || window.webkitAudioContext;



const context = new AudioContext();


function Midi2Freq(M){
	return 440 * Math.pow(2,(M-69)/12);
}

const bpm = 500;
const width = 3000;
const slotWidth = (width / (8 * 4 * 4));
const numNotes = 100;
const noteHeight = 21;
const leftOffset = 50;
const topOffset = 20;
const slots = document.getElementById('slots');
var playing = false;
var beats = 1;
var control = false;
var synth;

class Note{
	constructor(note,beats,vel,offset,arr){
		this.note = note;
		this.beats = beats;
		this.vel = vel;
		this.offset = offset;
		if (arr == undefined){
			this.arr = arrMaker(this, sineWaveAt);
		}
		else{
			this.arr = arr;
		}
	}
	copy(){
		return new Note(this.note, this.beats, this.vel, this.offset);
	}
	shortCopy(){
		return new Note(this.note, 1, this.vel, this.offset);
	}
}; 

class Synth{
    constructor(){
        this.a = .009;
        this.d = .3;
        this.s = 1;
        this.r = .1;
    }
}
class Osc{
    constructor(){
    this.type = 2;
    this.freqOffset = 0;
    }
    osc(number, freq){
        freq = freq += this.freqOffset;
        switch(this.type){
            case 1:
                return (number % freq) / freq;
                break;
            case 2:
                return Math.sin(number / (freq / (Math.PI * 2)));
        }
    }
}

function arrMaker(note, F){
	var arr = [];
	var tone = Midi2Freq(note.note);
	var seconds = note.beats / (bpm/60);
	var vel = note.vel;
	var len = context.sampleRate * seconds;
	for (var i = 0; i < len + .5 * context.sampleRate; i++) {
		arr[i] = F(i, tone, vel, i/context.sampleRate, seconds);
	}
	var buf = new Float32Array(arr.length)
	for (var i = 0; i < arr.length; i++) buf[i] = arr[i]
	return buf;
}

function playSound(arr) {
	var buffer = context.createBuffer(1, arr.length, context.sampleRate)
	buffer.copyToChannel(arr, 0)
	var source = context.createBufferSource();
	source.buffer = buffer;
	source.connect(context.destination);
	source.start(0);
}

function copyNotes(lon){
	ret = []
	for(var x = 0; x < lon.length; x++){
		ret.push(lon[x].copy());
	}
	return ret;
}

function sineWaveAt(sampleNumber, tone, vel, time, len) {
	var sampleFreq = context.sampleRate / tone;
	return env(synth.a,synth.d,synth.s,synth.r,time,len,true) * (vel/sampleFreq) * (sampleNumber % (sampleFreq));   //Math.sin(sampleNumber / (sampleFreq / (Math.PI * 2)));
}

function env(a, d, s, r, t, len, rec){
	if (t > len + r){
		return 0;
	}
	if (t > len && rec){
		var val = env(a,d,s,r,t,len,false) 
		return val - (t-len)/r * val;
	}
	if (t < a){
		return t/a;
	}
	if (t < (a + d)){
		return 1 - ((t-a)/d)*(1-s);
	}
	return s;
}

function createNote(x, y, note, beats, vel){ //
	var offset = Math.floor(x/slotWidth);
	n = new Note(note, beats, vel, offset);
	if (!playing){
		playSound(n.shortCopy().arr);
	}
	addNote(n, notes);
	var div = createDiv('note', "o" + offset + "n" + note, x, y, beats * slotWidth, 16);
	slots.appendChild(div);
    var subdiv = createDiv('drag', "d", 0,0,6,17);
    div.appendChild(subdiv);
    subdiv.addEventListener("mousedown", resize);	
    subdiv.ondragstart = function () {
          return false;
    };
    
	function addNote(n, lon){
		for (var i = 0; i < lon.length - 1; i++){
			if (n.offset >= lon[i].offset && n.offset <= lon[i+1].offset){
				lon.splice(i+1, 0, n);
				return;
			}
		}
		lon.push(n);
	}
}

function findNote(offset, note){ // returns the index of the first note that maches the given offset and frequency
	for (var i = 0; i < notes.length; i++){
		if (notes[i].offset == offset && notes[i].note == note){
            return i;
		}
	}
    return -1;
}

function removeNote(offset, note){
    notes.splice(findNote(offset, note), 1);
}
// Dclass is the div class, id is the div to be id
function createDiv(Dclass, id, x, y, width, height){ 
	var div = document.createElement('div');
	div.setAttribute('class', Dclass);
	div.style.top = y + "px";
	div.id = id;
	div.style.left = x + "px";
	div.style.width = width + "px";
	div.style.height = height + "px";
	return div;
}

function setUp(){ // creates all of the divs needed for workspace
	addSlots();
	addBars(8, slots, 3, width, true);
	function addSlots(){ // add the places for notes to go "slots"
		var cs = ["#222", "#555"];
		var slots = document.getElementById('slots');
		for (var i = 0 ; i < 100; i++){
			//for (var x = 0; x < width/slotWidth; x++){
				var div = createDiv('slot', "n" + (numNotes - i), leftOffset + 0 *slotWidth, i * noteHeight + topOffset, width, 17); 
				div.style.background = cs[i%2];
				slots.appendChild(div);
			//}
		}
	}
	function addBars(num, elem, rec, w, offset){ // create visual seperation of mesures
		if(rec < 1){
			return;
		}
		var o = 0;
		var or = 0;
		if (offset){ o = leftOffset; or = topOffset} 
		for (var i = 0; i < num; i++){
			var div = createDiv('bar', "bar", i * w/num + o, or, w/num, noteHeight * numNotes);
			elem.appendChild(div);
			addBars(4,div,rec-1, w/num, false);
		}
	}
}

function playNotes(lon , i){ //lon is a list of notes and i is the note index to start on
	if (playing == false){
		return;
	}
	if (lon.length-1 == i){
		playSound(arrMaker(lon[i],sineWaveAt));
		playing = false;
		return
	}
	n = lon[i];
	diff = lon[i+1].offset;
	diff -= n.offset;
	timeDiff = diff / (bpm/60);
	playSound(n.arr); // send the note samples to the buffer
	setTimeout(() => { playNotes(lon, i + 1); }, timeDiff * 1000); // walk through the rest of the list of notes
}
//init data
var synth = new Synth();
var attack = document.getElementById("attack");
// sliders
attack.oninput = function() {
      synth.a = (Math.pow(this.value, 2))/10000;
}

var decay = document.getElementById("decay");
decay.oninput = function() {
      synth.d = (Math.pow(this.value, 2))/1000;
}

var sustain = document.getElementById("sustain");
sustain.oninput = function() {
      synth.s = (this.value)/100;
}

var release = document.getElementById("release");
release.oninput = function() {
      synth.r = (this.value)/100;
}

var notes = [new Note(0,1,0,0)];
setUp();

//event handlers

function onPlay() {
	if (!playing){
		playing = true;
        function start(){
            playNotes(copyNotes(notes),0);
        }
		setTimeout(start, 0);
	}
    else {
        playing = false;
    }
}

function targetToNote(e){
    offset = parseInt(e.id.substring(1));
    note = parseInt(e.id.substring(e.id.indexOf("n")+1));
    return findNote(offset, note);
}

document.getElementById('container').onmousedown = function clickEvent(e) {
    if (control){
        offsetX = e.pageX + slots.scrollLeft - 7;
        div = createDiv("select", "temp", offsetX, e.target.offsetTop, 10, 10);
        slots.appendChild(div);
        startX = e.screenX;
        startY = e.screenY;
        document.addEventListener('mousemove', onMouseMove, false);
        document.addEventListener('mouseup', onMouseUp, false);
        function onMouseMove(e){
            div.style.width = e.screenX - startX + "px";
            div.style.height = e.screenY - startY + "px";
        }
        function onMouseUp(e){
            document.removeEventListener('mouseup', onMouseUp);
            document.removeEventListener('mousemove', onMouseMove);
        }
    }
}
document.getElementById('container').onclick = function clickEvent(e) {
    // e = Mouse click event.
    console.log(slots.scrollLeft);
    switch(e.target.id[0]) {
    case "n": // div id starts with n, indecating a slot
        var rect = e.target; 
        createNote(Math.floor((e.pageX + slots.scrollLeft - 7)/slotWidth)*slotWidth+3, rect.offsetTop, parseInt(e.target.id.substring(1)), beats, .1);
        break;
    case "o": // div id starts with a o, indecating a note 
        note = notes[targetToNote(e.target)]; // get note from list of notes
        beats = note.beats; //change the active note length to the selected note
        playSound(note.shortCopy().arr) // play a copy of the note that is shortened
        break;
    }            
}

window.onkeydown= function(gfg){ 
    if(gfg.code == "ControlLeft"){
        control = true;
    }
};

window.onkeyup= function(gfg){ 
    if(gfg.code == "ControlLeft"){
       control = false; 
    }
};

function resize(e){
    var target;
    var tnote;
    target = e.target.parentNode;
    var startWidth = parseFloat(target.style.width);
    var initX = e.clientX;
    tnote = notes[targetToNote(target)];
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    function onMouseMove(e){
        var newWidth = (startWidth + e.clientX - initX);
        newWidth = Math.floor((newWidth/slotWidth)+.5);
        tnote.beats = newWidth;
        beats = newWidth;
        newWidth = newWidth*slotWidth; 
        target.style.width = newWidth + "px";
    }
    function onMouseUp(e){
        document.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('mousemove', onMouseMove);
    }
}

document.getElementById('container').addEventListener('contextmenu', e => {
	if (e.target.id[0] != "o"){
		e.preventDefault();
		return;
	}
	e.target.remove();
    notes.splice(targetToNote(e.target), 1);
    e.preventDefault();
});
////////////////////
