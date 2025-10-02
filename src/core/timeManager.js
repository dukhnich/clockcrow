import { Observer } from "../utils/observer.js";

class DaySettings {
    #start
    #end
    #nightStart
    #nightEnd
    constructor(start = 0, end = 24, nightStart = 21, nightEnd = 5) {
        this.#start = start;
        this.#end = end;
        this.#nightStart = nightStart;
        this.#nightEnd = nightEnd;
    }
    get start() { return this.#start; }
    get end() { return this.#end; }
    get nightStart() { return this.#nightStart; }
    get nightEnd() { return this.#nightEnd; }
    isDayHour(hour) {
        return hour >= this.#nightEnd && hour < this.#nightStart;
    }
    isNightHour(hour) {
        return !this.isDayHour(hour);
    }
}
export class TimeManager extends Observer {
    #startTime;
    #endTime;
    #currentTime;
    #settings;
    constructor(startTime = 9, endTime = 5, settings = new DaySettings()) {
        super();
        this.#startTime = startTime;
        this.#endTime = endTime;
        this.#currentTime = this.#startTime;
        this.#settings = settings;
    }
    get startTime() { return this.#startTime; }
    get endTime() { return this.#endTime; }
    get currentTime() { return this.#currentTime; }
    set currentTime(value) {
        if (value >= this.#settings.end) {
            value -= this.#settings.end;
        }
        if (value < 0) {
            value = 0;
        }
        if (value > this.#endTime) {
            value = this.#endTime;
        }
        if (this.#currentTime !== value) {
            this.#currentTime = value;
            this.notify(this.#currentTime);
        }
    }
    tick(hours) {
        this.currentTime += hours;
    }
    reset() {
        this.currentTime = this.#startTime;
    }
    isDay() {
        return this.#settings.isDayHour(this.#currentTime);
    }
    isNight() {
        return this.#settings.isNightHour(this.#currentTime);
    }
};

export default { TimeManager };