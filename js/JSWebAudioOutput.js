/*

 Copyright (c) 2013 David Gundersen

 Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
 documentation files (the "Software"), to deal in the Software without restriction, including without limitation
 the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software,
 and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all copies or substantial portions
 of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
 LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

 */

/*
 * AUDIO OUTPUT (WEB AUDIO API)
 */

(function(){
    "use strict";

    var WA_BUF_SIZE = 2048;
    var WA_NUM_OUTPUT_CHANNELS = 2;

    /**
     * Web Audio ("ScriptProcessorNode") audio output functionality
     * @param mixer A mixer function that gets called periodically to produce new sampled audio data.
     * @constructor
     */
    jssynth.WebAudioOutput = function(mixer, bufferSize) {
        this.context = new webkitAudioContext();
        this.node = this.context.createScriptProcessor(bufferSize || WA_BUF_SIZE, 0, WA_NUM_OUTPUT_CHANNELS);

        this.nextSamples = null;
        this.nextSamplesOffset = 0;

        var self = this;

        this.node.onaudioprocess = function(event) {
            var outputBuffer = event.outputBuffer;
            var sampleRate = outputBuffer.sampleRate;
            var bufferLength = outputBuffer.length;
            var channelData = [ outputBuffer.getChannelData(0), outputBuffer.getChannelData(1) ];

            var outputOfs = 0;

            while (outputOfs < bufferLength) {
                if (!self.nextSamples) {
                    self.nextSamples = mixer.mix(sampleRate);
                    self.nextSamplesOffset = 0;
                }

                for (var chan = 0; chan < WA_NUM_OUTPUT_CHANNELS; chan++) {
                    for (var i = 0; ((self.nextSamplesOffset+i) < self.nextSamples.bufferSize) && ((i + outputOfs) < bufferLength); i++) {
                        channelData[chan][outputOfs+i] = self.nextSamples.output[chan][self.nextSamplesOffset + i];
                    }
                }
                outputOfs += i;
                self.nextSamplesOffset += i;

                if (self.nextSamplesOffset >= self.nextSamples.bufferSize) {
                    self.nextSamples = null;
                }
            }
        }
    }

    /**
     * Start the audio output
     */
    jssynth.WebAudioOutput.prototype.start = function() {
        this.node.connect(this.context.destination);
    }

    /**
     * Stop/pause the audio output
     */
    jssynth.WebAudioOutput.prototype.stop = function() {
        this.node.disconnect();
    }

})();