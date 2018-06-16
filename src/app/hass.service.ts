import { Injectable } from '@angular/core';
import { WebsocketService } from './websocket.service';
import { BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class HassService {
  // store callbacks that can be run on socket responses, if the id matches
  private id = 0;
  private msgHandler: any = {};

  // store the hass config and state
  // uses method from https://coryrylan.com/blog/angular-observable-data-services
  private _states: BehaviorSubject<any[]>;
  private _services: BehaviorSubject<any[]>;
  private _config: BehaviorSubject<any>;
  private dataStore: {
    states: any[],
    services: any[],
    config: any
  };

  constructor(
    private wsService: WebsocketService
  ) {
    this.dataStore = { states: [], services: [], config: {} };
    this._states = <BehaviorSubject<any[]>>new BehaviorSubject([]);
    this._services = <BehaviorSubject<any[]>>new BehaviorSubject([]);
    this._config = <BehaviorSubject<any>>new BehaviorSubject([]);
    this.socketHandler();
    this.load('states', this._states);
    this.load('services', this._services);
    this.load('config', this._config);
    this.listen();
    /*
    this.call('light', 'turn_off', {
      entity_id: 'light.ge_unknown_type5044_id3038_level',
      brightness: 0
    });
    */
  }

  get states() { return this._states.asObservable(); }
  get services() { return this._services.asObservable(); }
  get config() { return this._config.asObservable(); }

  // initialize dataStore states, services and config
  private load(varName: string, bs: any) {
    const myId = (+ new Date()) * 1000 + this.id++ % 1000;
    const msg = { id: myId, type: 'get_' + varName };
    this.msgHandler[myId] = (data) => {
      console.log(data);
      this.dataStore[varName] = data.result;
      bs.next(Object.assign({}, this.dataStore)[varName]);
    };
    this.wsService.sendMessage(JSON.stringify(msg));
  }

  // subscribe to state_changed events
  // update this.dataStore.states with updated state and emit the new state
  private listen() {
    const myId = (+ new Date()) * 1000 + this.id++ % 1000;
    const msg = { id: myId, type: 'subscribe_events', event_type: 'state_changed'};
    this.msgHandler[myId] = (resp) => {
      if (resp.hasOwnProperty('event') && resp.event.hasOwnProperty('data')) {
        const data = resp.event.data;
        this.dataStore.states.find(x => x.entity_id === data.entity_id).attributes = data.new_state.attributes;
        this._states.next(Object.assign({}, this.dataStore).states);
      }
    };
    this.wsService.sendMessage(JSON.stringify(msg));
  }

  // call service
  call(domain: string, service: string, service_data?: any) {
    const myId = (+ new Date()) * 1000 + this.id++ % 1000;
    const msg = { id: myId, type: 'call_service', domain: domain, service: service };
    if (service_data) { msg['service_data'] = service_data; }
    this.wsService.sendMessage(JSON.stringify(msg));
  }

  // subscribe to the websocket and process incoming messages
  private socketHandler() {
    this.wsService.socket
      .pipe(map(data => JSON.parse(data)))
      .subscribe(data => {
        if (this.msgHandler.hasOwnProperty(data.id)) {
          this.msgHandler[data.id](data);
        }
      });
  }

}