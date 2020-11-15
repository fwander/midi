window.AudioContext = window.AudioContext || window.webkitAudioContext;



var context = new AudioContext();


function Midi2Freq(M){
	return 440 * Math.pow(2,(M-69)/12);
}

var bpm = 200;
var width = 5000;
var slotWidth = (width / (8 * 4 * 4));
var numNotes = 100;
var noteHeight = 21;
var leftOffset = 50;
var topOffset = 20;
var slots = document.getElementById('slots');
var playing = false;
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
		return new Note(this.note, this.beats, this.vel, this.offset, this.arr);
	}
}; 

function arrMaker(note, F){
	var arr = [];
	var tone = Midi2Freq(note.note);
	var seconds = note.beats / (bpm/60);
	var vel = note.vel;
	var len = context.sampleRate * seconds;
	for (var i = 0; i < len + .5 * context.sampleRate; i++) {
		arr[i] = F(i, tone, vel, i/context.sampleRate, seconds);
	}

	return arr;

}
function playSound(arr) {
	var buf = new Float32Array(arr.length)
	for (var i = 0; i < arr.length; i++) buf[i] = arr[i]
	var buffer = context.createBuffer(1, buf.length, context.sampleRate)
	buffer.copyToChannel(buf, 0)
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
	var a = .06;
	var d = .1;
	var s = 1;
	var r = .1;
	var sampleFreq = context.sampleRate / tone;
	return env(a,d,s,r,time,len,true) * vel * Math.sin(sampleNumber / (sampleFreq / (Math.PI * 2)));
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

function createNote(x, y, note, beats, vel){
	var offset = Math.floor(x/slotWidth);
	n = new Note(note, beats, vel, offset);
	if (!playing){
		playSound(n.arr);
	}
	addNote(n, notes);
	for (var i = 0 ; i < notes.length; i++){
		console.log(notes[i].offset);
	}
	var div = createDiv('note', "o" + offset + "n" + note, x, y, beats * slotWidth, 16);
	slots.appendChild(div);
	
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

function removeNote(offset, note){
	for (var i = 0; i < notes.length; i++){
		if (notes[i].offset == offset && notes[i].note == note){
			notes.splice(i, 1);
		}
	}
}

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
function setUp(){
	
	addSlots();
	addBars(8, slots, 3, width, true);

	function addSlots(){
		var cs = ["#222", "#555"];
		var slots = document.getElementById('slots');
		for (var i = 0 ; i < 100; i++){
			for (var x = 0; x < width/slotWidth; x++){
				var div = createDiv('slot', "n" + (numNotes - i), leftOffset + x * slotWidth, i * noteHeight + topOffset, slotWidth, 17); 
				div.style.background = cs[i%2];
				slots.appendChild(div);
			}
		}
	}

	function addBars(num, elem, rec, w, offset){
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

function playNotes(lon , i){
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
	timeDiff = diff / (bpm/60)
	playSound(n.arr);
	setTimeout(() => { playNotes(lon, i + 1); }, timeDiff * 1000);
}
//init data
var notes = [new Note(0,1,0,0)];
setUp();

//event handlers

function onPlay() {
	if (!playing){
		playing = true;
		playNotes(copyNotes(notes),0);
	}
}

document.getElementById('container').onclick = function clickEvent(e) {
      // e = Mouse click event.
	console.log(e.target.id);
	if (e.target.id[0] != "n"){
	return;
	}
	var rect = e.target;
	createNote(rect.offsetLeft, rect.offsetTop, parseInt(e.target.id.substring(1)), 2, .2);
}
document.getElementById('container').addEventListener('contextmenu', e => {
	if (e.target.id[0] != "o"){
		e.preventDefault();
		return;
	}
	e.target.remove();
	offset = parseInt(e.target.id.substring(1));
	note = parseInt(e.target.id.substring(e.target.id.indexOf("n")+1));
	removeNote(offset,note);
  e.preventDefault();
});
