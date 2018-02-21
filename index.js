import Transport from "winston-transport";
import { LEVEL, MESSAGE } from "triple-beam";
import { promisify } from "util";

const defaults = {
  numPerBatch: 1,
  maxPayloads: 1024,
  topic: "winston-logs",
};

class KafkaTransport extends Transport {
  constructor(rawOpts = {}) {
    const opts = { ...defaults, ...rawOpts };

    super(opts);

    this.payloads = [];
    this.numPerBatch = opts.numPerBatch;
    this.topic = opts.topic;
    this.maxPayloads = opts.maxPayloads;
    this.producer = opts.producer;
    this.send = promisify(this.producer.send).bind(this.producer);
  }

  addPayload(payload) {
    if (this.payloads.length > this.maxPayloads) {
      console.log("Error: payload buffer exceeded");
      return;
    }

    this.payloads.push(payload);
  }

  addMessage(message) {
    this.addPayload({ topic: this.topic, messages: [message] });
  }

  processPayloads() {
    if (this.payloads.length >= this.numPerBatch) {
      const payloads = this.payloads;
      this.clearPayloads();

      this.send(payloads).catch(err => {
        console.log(err);
        payloads.forEach(payload => this.addPayload({ topic: payload.topic, messages: payload.messages }));
      });
    }
  }

  clearPayloads() {
    this.payloads = [];
  }

  log(info, callback) {
    setImmediate(() => {
      this.emit("logged", info);
    });

    this.addMessage(info[MESSAGE]);

    this.processPayloads();

    if (callback) {
      callback();
    }
  }
}

export default KafkaTransport;
