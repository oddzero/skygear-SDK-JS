import {
  btoa,
  atob
} from 'Base64';
import stream from 'stream';
import {IncomingForm} from 'formidable';
import {parse} from 'url';

/**
 * This is thin request object trying to provide a http.IncomingMessage like
 * object for access http request properties.
 */
class SkygearRequest {
  constructor(param) {
    this.headers = param.header;
    this.method = param.method;
    this.path = param.path;
    this.queryString = param.query_string;
    this.body = atob(param.body);
    this.url = parse(`${this.path}?${this.queryString}`, true);
  }

  get query() {
    return this.url.query;
  }

  form(callback) {
    const req = new stream.PassThrough();
    req.headers = {
      'content-type': this.headers['Content-Type'][0],
      'content-length': this.headers['Content-Length'][0]
    };
    req.end(this.body);
    const f = new IncomingForm();
    return f.parse(req, callback);
  }

  get json() {
    return JSON.parse(this.body);
  }
}

export default class CommonTransport {
  constructor(registry) {
    this.registry = registry;
  }

  start() {
    throw new Error('Not implemented');
  }

  initHandler(payload) {
    // TODO: properly parse and save the skygear-server config
    this.config = payload;
    return this.registry.funcList();
  }

  hookHandler(payload) {
    const {
      name,
      param
    } = payload;
    const func = this.registry.getFunc('hook', name);
    if (!func) {
      throw new Error('Databse hook does not exist');
    }
    // TODO: Make the record is a SDK Record
    let record = func(param);
    if (record === undefined) {
      record = param.record;
    }
    return {
      result: record
    };
  }

  opHandler(payload) {
    const func = this.registry.getFunc('op', payload.name);
    if (!func) {
      throw new Error('Lambda not exist');
    }
    return {
      result: func(payload.param)
    };
  }

  timerHandler(payload) {
    const func = this.registry.getFunc('timer', payload.name);
    if (!func) {
      throw new Error('Cronjob not exist');
    }
    return {
      result: func(payload.param)
    };
  }

  handlerHandler(payload) {
    const {
      method
    } = payload.param;
    const func = this.registry.getHandler(payload.name, method);
    if (!func) {
      throw new Error('Handler not exist');
    }
    const req = new SkygearRequest(payload.param);
    const result = func(req);

    const headers = {};
    let body;
    if (typeof result === 'string') {
      headers['Content-Type'] = ['text/plain; charset=utf-8'];
      body = btoa(result);
    } else {
      headers['Content-Type'] = ['application/json'];
      body = btoa(JSON.stringify(result));
    }
    const response = {
      status: 200,
      header: headers,
      body: body
    };
    return {
      result: response
    };
  }
}