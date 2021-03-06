/*
	Pill Box that you plead with to unlock and 
	get your pills.

	Uses the Snowboy to listen for 'hotwords'. It listens
	for any of the hotwords. If heard n times in 2 minutes
	the box unlocks. After 2 minutes, n is set to a random 
	number between 1 and 6 and the box locks.

	LED's flash when box turns on. When a plead is received
	but more are needed, the red LED flashes. When enough
	pleads are received, the green LED stays on for 2 minutes.

	created 02/05/2020
	Noah Kernis and Ben Moll
*/

const Pigpio = require('pigpio');
const Snowboy = require('snowboy');
const Record = require('node-record-lpcm16');

// NOTE: -----> Define Listener <-----

const listener = Record.record({
	verbose: true,
	recorder: "arecord",
	device: "plughw:1,0",
	endOnSilence: false
});

// NOTE: -----> Setup GPIO <-----

const Gpio = Pigpio.Gpio;

const redLed = new Gpio(5, {
	mode: Gpio.OUTPUT
});

const greenLed = new Gpio(6, {
	mode: Gpio.OUTPUT
});

// NOTE: -----> LED Blink <-----

function blinkLed(led, numberBlinks=1, timeout=1000) {
	changeLedState(led);

	let interval = setInterval(() => {
		changeLedState(led);
	}, timeout);

	stopBlink(interval, numberBlinks, timeout, led);
}

function changeLedState(led) {
	let newLedState = +!led.digitalRead();

	led.digitalWrite(newLedState);
}

function stopBlink(interval, numberBlinks, timeout, led) {
	let newTimeout = 2 * timeout * numberBlinks;

	setTimeout(() => {
		clearInterval(interval);
		led.digitalWrite(0)
	}, newTimeout);
}

// NOTE: -----> Servo <-----

// servo pulses at 50Hz on the GPIO
// 0 (off), 500 (most anti-clockwise) to 2500 (most clockwise)

// pulse width in microseconds
const pulseWidthClose = 2000;
const pulseWidthOpen = 1000;

const motor = new Gpio(13, {
	mode: Gpio.OUTPUT
});

function openPillBox() {
	console.log('Unlocking Pill Box...');
	
	greenLed.digitalWrite(1)
	motor.servoWrite(pulseWidthOpen);
	listener.pause();
}

function closePillBox() {
	console.log('Locking Pill Box...');

	greenLed.digitalWrite(0)
	resetPleads();

	blinkLed(greenLed, 3, 500);
	blinkLed(redLed, 3, 500);

	motor.servoWrite(pulseWidthClose);
	listener.resume();
}

function handleUnlock() {
	openPillBox();

	setTimeout(closePillBox, 30000);
}

// NOTE: -----> Plead State <-----

const pleadsNeeded = 3;
let pleads = 0;

function receivedPlead() {
	pleads += 1;

	if (pleads == pleadsNeeded) {
		handleUnlock();
	} else {
		blinkLed(redLed);
	}
}

function resetPleads() {
	pleads = 0;
}

// NOTE: -----> Create Listener <-----

const Models = Snowboy.Models;
const Detector = Snowboy.Detector;

const models = new Models();

const hotwords = [
	["begging", "0.5"],
	["die", "0.5"],
	["give", "0.5"],
	["have", "0.5"],
	["help", "0.5"],
	["let", "0.5"],
	["life", "0.5"],
	["live", "0.5"],
	["need", "0.5"],
	["please", "0.5"]
];

hotwords.forEach(hotword => {
	models.add({
		file: "resources/models/" + hotword[0] + ".pmdl",
		hotwords: hotword[0],
		sensitivity: hotword[1]
	})
})

const detector = new Detector({
	resource: "node_modules/snowboy/resources/common.res",
	language: 'en-US',
	models: models,
	audioGain: 1.0,
	applyFrontend: false
});

detector.on('silence', function () {
	console.log('silence');
});

detector.on('hotword', function (i, hotword) {
	console.log('hotword', hotword);
	receivedPlead();
});

detector.on('error', function () {
	console.log('error');
});

// NOTE: -----> Start Everything <-----

console.log('Starting listener...');

// make sure leds are off
redLed.digitalWrite(0);
greenLed.digitalWrite(0);

// flash leds
blinkLed(redLed, 2, 500);
blinkLed(greenLed, 2, 500);

// make sure box is closed
closePillBox();

// start listening 
listener.stream().pipe(detector);
