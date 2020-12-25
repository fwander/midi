window.AudioContext = window.AudioContext || window.webkitAudioContext;



const context = new AudioContext();


function Midi2Freq(M){
	return 440 * Math.pow(2,(M-69)/12);
}

function sleep(ms) {
          return new Promise(resolve => setTimeout(resolve, ms));
}

const bpm = 400;
const width = 3072;
const slotWidth = (width / (8 * 4 * 4));
const noteHeight = 21;
const leftOffset = 50;
const topOffset = 20;
const slots = document.getElementById('slots');
const lowestNote = 36;
const highestNote = 85;
var sampleBufferSize = Math.floor(context.sampleRate / 5);
var numNotes = highestNote - lowestNote;
var playing = false;
var beats = 1;
var control = false;
var shift = false;
var synth;
var selected = [];
var sources = [];

class Note{
	constructor(note,beats,vel,offset,div){
		this.note = note;
		this.beats = beats;
		this.vel = vel;
		this.offset = offset;
        this.div = div;
	}
    render(startSample){
        var arr = new Float32Array(sampleBufferSize); 
        var tone = Midi2Freq(this.note);
        var seconds = (this.beats) / (bpm/60);
        var index = 0;
        for(var i = startSample; i < startSample + sampleBufferSize; i++){
            if (i >= 0){
                arr[index] = sineWaveAt(i, tone, this.vel, i/context.sampleRate, seconds);
            }
            else{
                arr[index] = 0;
            }
            index++;
        } 
        return arr;
    }
	copy(){
		return new Note(this.note, this.beats, this.vel, this.offset, this.div);
	}
	shortCopy(){
		return new Note(this.note, 1, this.vel, this.offset, this.div);
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
	var seconds = (note.beats) / (bpm/60);
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

function genSaw(t, f){
    var result = 0;
    var it = 1;
    for(var i = 1; i < 2; i++){
        result += Math.sin(t/((f/i)/(Math.PI * 2)))/i * it; 
        it *= -1;
        
    }
    return result;
}

function sineWaveAt(sampleNumber, tone, vel, time, len) {
	var sampleFreq = context.sampleRate / tone;
    //((sampleNumber % (sampleFreq))/sampleFreq);
    //
	return env(synth.a,synth.d,synth.s,synth.r,time,len,true) * (vel) * genSaw(sampleNumber,sampleFreq);
	//return env(synth.a,synth.d,synth.s,synth.r,time,len,true) * (vel) * Math.sin(sampleNumber / (sampleFreq / (Math.PI * 2)));
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
	var div = createDiv('note', "o" + offset + "n" + note, x, y, beats * slotWidth, 16);
	n = new Note(note, beats, vel, offset, div);
	addNote(n, notes);
	slots.appendChild(div);
    var subdiv = createDiv('drag', "d", 0,0,6,17);
    div.appendChild(subdiv);
    subdiv.addEventListener("mousedown", resize);	
    div.addEventListener("mousedown", drag);	
    subdiv.ondragstart = function () {
          return false;
    };
    return n;
}

function addNote(n, lon){
    for (var i = 0; i < lon.length - 1; i++){
        if (n.offset >= lon[i].offset && n.offset <= lon[i+1].offset){
            lon.splice(i+1, 0, n);
            return;
        }
    }
    lon.push(n);
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
		for (var i = 0 ; i < highestNote - lowestNote; i++){
            var div = createDiv('slot', "n" + (numNotes - i + lowestNote), leftOffset + 0 *slotWidth, i * noteHeight + topOffset, width, 17); 
            div.style.background = cs[i%2];
            slots.appendChild(div);
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


async function playBBB(lon){ //play buffer by buffer
    var i = 0;
    var sec = 0;
    var sample = 0;
    var notesOn = [];
    var startTime = context.currentTime;
    var timeStep = (sampleBufferSize / context.sampleRate);

    var lastTime = startTime;
    var buf = new Float32Array(sampleBufferSize);
    sources = [];
    while(playing){
        
        var beats = fromTime(sec);
        if (i >= lon.length && notesOn.length == 0){
            playing = false;
            break;
        }
        while(i < lon.length && beatsToSeconds(lon[i].offset) <= sec + .1){
            notesOn.push(i++);
        }
        var notesOff = [];
        for(var s = 0; s < sampleBufferSize; s++){
            buf[s] = 0;
        }
        for(var n = 0; n < notesOn.length; n++){
            var note = lon[notesOn[n]];
            var startSample = beatsToSamples(note.offset);
            var arr = note.render(sample - startSample); 
            for(var s = 0; s < sampleBufferSize; s++){
                buf[s] += arr[s];
            }
            
            if(beats > note.offset + note.beats + 8){
                notesOff.push(n);
            }
        }
        notesOff.sort();
        notesOff.reverse();
        for(var n = 0; n < notesOff.length; n++){
            notesOn.splice(notesOff[n],1);
            console.log(beats, notesOn, lon[n]);
        }

        var buffer = context.createBuffer(1, buf.length, context.sampleRate)
        buffer.copyToChannel(buf, 0)
        var source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);

        sec += timeStep;
        sample += sampleBufferSize;
         
        //await sleep(10); //make sure the page doesn't freeze up
        var currentTime = context.currentTime - startTime;
        lastTime = context.currentTime;

        
        source.start(sec + startTime);
        sources.push(source);
    }
    function fromTime(seconds){
        var min = seconds/60;
        return bpm * min;
    }
    function beatsToSeconds(beats){
         return (1 / (bpm/(beats))) * 60;
    }
    function beatsToSamples(beats){
        var seconds = beatsToSeconds(beats);
        return seconds * context.sampleRate; 
    }
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

var notes = [new Note(0,1,0,0,null)];
setUp();

//event handlers

function onPlay() {
	if (!playing){
		playing = true;
        function start(){
            var input = Array(notes.length); 
            for(var i = 0; i < notes.length; i++){
                input[i] = notes[i].copy();
            }

            playBBB(input);
        }
		setTimeout(start, 0);
	}
    else {
        for(var i = 0; i<sources.length; i++){
            sources[i].stop(0);
        }
        playing = false;
    }
}

function deselect(){
    for(var i = 0; i < selected.length; i++){
        selected[i].div.style.background = "#bb5";
    }
    selected = [];
}

function copySelected(){
    for(var i = 0; i < selected.length; i++){
        selected[i].div.style.background = "#bb5";
        selected[i] = createNote(parseInt(selected[i].div.style.left), parseInt(selected[i].div.style.top), selected[i].note, selected[i].beats, selected[i].vel);
        selected[i].div.style.background = "#000";
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
        offsetY = (e.pageY + slots.scrollTop - topOffset - 28);
        div = createDiv("select", "temp", offsetX, offsetY, 10, 10);
        slots.appendChild(div);
        startX = e.screenX;
        startY = e.screenY;
        document.addEventListener('mousemove', onMouseMove, false);
        document.addEventListener('mouseup', onMouseUp, false);
        
        var maxNote = numNotes + 3 + lowestNote - Math.floor((e.pageY + slots.scrollTop - 28)/noteHeight);
        var minOffset = Math.floor((e.pageX + slots.scrollLeft - 7)/slotWidth);
        function onMouseMove(e){
            div.style.width = e.screenX - startX + "px";
            div.style.height = e.screenY - startY + "px";
        }
        function onMouseUp(e){
            
            div.remove();
            var minNote = numNotes + 1 + lowestNote - Math.floor((e.pageY + slots.scrollTop - 28)/noteHeight);
            var maxOffset = Math.floor((e.pageX + slots.scrollLeft - 7)/slotWidth) + 1;
            console.log(minOffset);
            console.log(maxOffset);
            selected = [];
            for (var i = 1; i < notes.length; i++){
                var note = notes[i];
                note.div.style.background = "#bb5";
                if (note.note > minNote && note.note < maxNote && note.offset + note.beats > minOffset && note.offset < maxOffset){
                    console.log("hello");
                    note.div.style.background = "#000";
                    selected.push(note);
                }
            }
            document.removeEventListener('mouseup', onMouseUp);
            document.removeEventListener('mousemove', onMouseMove);
        }
    }
}
document.getElementById('container').ondragstart = function() { return false; };
document.getElementById('container').onclick = function clickEvent(e) {
    console.log(slots.scrollLeft);
    switch(e.target.id[0]) {
    case "n": // div id starts with n, indecating a slot
        deselect();
        var rect = e.target; 
        var note = createNote(Math.floor((e.pageX + slots.scrollLeft - 7)/slotWidth)*slotWidth+2, rect.offsetTop, parseInt(e.target.id.substring(1)), beats, .1);
        playSound(arrMaker(note.shortCopy(), sineWaveAt)); // play a copy of the note that is shortened
        break;
    case "o": // div id starts with a o, indecating a note 
        note = notes[targetToNote(e.target)]; // get note from list of notes
        beats = note.beats; //change the active note length to the selected note
        playSound(arrMaker(note.shortCopy(), sineWaveAt)); // play a copy of the note that is shortened
        break;
    }            
}

window.onkeydown= function(gfg){ 
    if(gfg.code == "ControlLeft"){
        control = true;
    }
    if(gfg.code == "ShiftLeft"){
        shift = true;
    }
    console.log(gfg.code);
    if(gfg.code == "Delete"){
        for(var i = 0; i < selected.length; i++){
            selected[i].div.remove();
            var index = findNote(selected[i].offset, selected[i].note);
            notes.splice(index, 1);
        }
        selected = [];
    }
};

window.onkeyup= function(gfg){ 
    if(gfg.code == "ControlLeft"){
       control = false; 
    }
    if(gfg.code == "ShiftLeft"){
        shift = false;
    }
};

function resize(e){
    var target;
    var tnote;
    target = e.target.parentNode;
    var initX = e.clientX;
    tnote = notes[targetToNote(target)];
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    var sel = [tnote];
    if (selected.length != 0){
       sel = selected; 
    }
    var startwidth = [];
    for (var i = 0; i < sel.length; i++){
        startwidth.push(sel[i].beats * slotWidth); 
    }
    console.log(startwidth);
    function onMouseMove(e){
        for (var i = 0; i < sel.length; i++){
            var newWidth = (startwidth[i] + e.clientX - initX);
            newWidth = Math.floor((newWidth/slotWidth)+.5);
            sel[i].beats = newWidth;
            newWidth = newWidth*slotWidth; 
            sel[i].div.style.width = newWidth + "px";
        }
    }
    function onMouseUp(e){
        document.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('mousemove', onMouseMove);
    }
}

function drag(e){
    console.log(e);
    if (e.target.id[0] != "o" || control || e.button != 0){
        return;
    }
    var target;
    var tnote;
    target = e.target;
    var initX = e.clientX;
    var initY = e.clientY;
    tnote = notes[targetToNote(target)];
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    var sel = [tnote];
    if(shift){
        copySelected();
        console.log(selected[0]);
    }
    if (selected.length != 0){
       sel = selected; 
    }
    var startX = [];
    var startY = [];
    var startOff = [];
    var startNote = [];
    for (var i = 0; i < sel.length; i++){
        startX.push(parseInt(sel[i].div.style.left)); 
        startY.push(parseInt(sel[i].div.style.top)); 
        startOff.push(sel[i].offset);
        startNote.push(sel[i].note);
    }
    function onMouseMove(e){
        for (var i = 0; i < sel.length; i++){
            var newX = (startX[i] + Math.floor((e.clientX - initX)/slotWidth)*slotWidth);
            var newY = (startY[i] + Math.floor((e.clientY - initY)/noteHeight)*noteHeight);
            var offdiff = Math.floor((e.clientX - initX)/slotWidth);
            var notediff = Math.floor((e.clientY - initY)/noteHeight);
            sel[i].offset = startOff[i] + offdiff;
            sel[i].note = startNote[i] - notediff;
            sel[i].div.id = "o" + sel[i].offset + "n" + sel[i].note;
            sel[i].div.style.left = newX + "px";
            sel[i].div.style.top = newY + "px";
        }
    }
    function onMouseUp(e){
        for(var i = 0; i < sel.length; i++){
            removeNote(sel[i].offset, sel[i].note);
        }
        for(var i = 0; i < sel.length; i++){
            addNote(sel[i],notes);
        }
        document.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('mousemove', onMouseMove);
    }
}

document.getElementById('container').addEventListener('contextmenu', e => {
    var inSelected = false;
	if (e.target.id[0] != "o"){
        deselect();
		e.preventDefault();
		return;
	}
    var index = targetToNote(e.target)
    console.log(notes[index]);
	e.target.remove();
    //for(var i = 0; i < selected.length; i++){
        //if (selected[i].note == notes[index].note && selected[i].offset == notes[index].offset){
            //selected.splice(i,1);
            //inSelected = true;
        //}
    //}

    notes.splice(index, 1);
    
    if (!inSelected){
        deselect();
    }
    console.log(notes);
    e.preventDefault();
});
////////////////////
