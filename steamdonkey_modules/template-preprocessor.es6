
/**
 * Template Preprocessor Class
 * @module steamdonkey_modules/template-preprocessor
 */

"use strict";
import fs from 'fs';
import path from 'path';
import chokidar from 'chokidar';

const NAME = 'template-preprocessor';
const DOT = '.';
const SLASH = '/';
const BACKSLASH = '\\';
const LINE_START = '^';
const LINE_END = '$';
const READONLY = 'r'
const UTF8 = 'utf-8'
const INDENT = '    ';
const HYPHEN = '-';
const CREATE = 'add';
const UPDATE = 'change';
const DELETE = 'unlink';

class TemplatePreprocessor
{
  constructor(folders = {}, layout = {}, debug = false) {
    this.folders = folders;
    this.layout = layout;
    this.debug = debug;
    this.baseDir = this.folders.layout.root + this.folders.layout.src;
    this.templateDir = this.folders.layout.root + this.folders.layout.templates;
  }
  
  processTemplates() {
    let data = this._getObjects(this.baseDir, this.baseDir, 
                                this.layout.file_extensions.markup);
    let objects = this._makeObjectTypes(this.baseDir, data);
    this._resolveTemplates(this.baseDir, objects);
  }

  _resolveTemplates(baseDir, objects = {}) {
    let dependencies = {};
    let templatesResolved = {};
    let site = this.layout.object_types.global;
    let templates = this.layout.object_types.templates;
    
    const MARKUP_ID = this.layout.identifiers.markup;
    const STYLE_ID = this.layout.identifiers.style;
    const SCRIPT_ID = this.layout.identifiers.script;
    
    const MARKUP_EXT = this.layout.file_extensions.markup;
    const STYLE_EXT = this.layout.file_extensions.style;
    const SCRIPT_EXT = this.layout.file_extensions.script;
    
    dependencies[site] = [];
    
    for (let tpl in objects[templates]) {
    
      dependencies[site].push(tpl);
      dependencies[templates + HYPHEN + tpl] = [tpl];
      templatesResolved[tpl] = new Object();
      templatesResolved[tpl][MARKUP_ID] = "";
      templatesResolved[tpl][STYLE_ID] = []
      templatesResolved[tpl][SCRIPT_ID] = [];
     
      let template = objects[templates][tpl];
        
      if (template[STYLE_EXT]) {
          templatesResolved[tpl][STYLE_ID].push(tpl);
      }
      if (template[SCRIPT_EXT]) {
          templatesResolved[tpl][SCRIPT_ID].push(tpl);
      }

      let markup = template[MARKUP_ID];     
      
      let match;
      while (match = /(\<!--\s*@import\s*(.*?):(.*?)\s*--\>)/ig.exec(markup)) {
        let type = match[2];
        let name = match[3];
        markup = markup.replace(match[1], objects[type][name][MARKUP_ID]);
        
        let _key = type + HYPHEN + name;
        if(typeof dependencies[_key] === 'undefined') {
          dependencies[_key] = [];
        }
        dependencies[_key].push(tpl);
        
        if (objects[type][name][STYLE_EXT]) {
          templatesResolved[tpl][STYLE_ID].push(name);
        }
        if (objects[type][name][SCRIPT_EXT]) {
          templatesResolved[tpl][SCRIPT_ID].push(name);
        }
      }
      
      let globalMarkup = fs.readFileSync(baseDir + site + SLASH + site + DOT + MARKUP_EXT, UTF8);
      markup = globalMarkup.replace("<!-- $" + MARKUP_ID + " -->", markup);

      let _repl = '';
      try {
        fs.openSync(baseDir + site + DOT + STYLE_EXT, READONLY)
        _repl += '<link rel="stylesheet" href="' + SLASH + this.folders.assets.root + this.folders.assets[STYLE_ID] + site + DOT + STYLE_EXT + '" />' + "\n"
      } catch(e) {}
      for (let i = 0; i < templatesResolved[tpl][STYLE_ID].length; i++) {
        _repl += '\t<link rel="stylesheet" href="' + SLASH + this.folders.assets.root + this.folders.assets[STYLE_ID] + templatesResolved[tpl][STYLE_ID][i] + DOT +  STYLE_EXT + '" />' + "\n"
      }
      markup = markup.replace("<!-- $" + STYLE_ID + " -->", _repl.replace(/\n\t$/,''));
      
      _repl = '';
      try {
        fs.openSync(baseDir + site + DOT + SCRIPT_EXT, READONLY)
        _repl += '<script src="' + SLASH + this.folders.assets.root + this.folders.assets[SCRIPT_ID] + site + DOT + SCRIPT_EXT + '"></script>' + "\n"
      } catch(e) {}
      for (let i = 0; i < templatesResolved[tpl][SCRIPT_ID].length; i++) {
        _repl += '\t<script src="' + SLASH + this.folders.assets.root + this.folders.assets[SCRIPT_ID] + templatesResolved[tpl][SCRIPT_ID][i] + DOT +  SCRIPT_EXT + '"></script>' + "\n"
      }
      markup = markup.replace("<!-- $" + SCRIPT_ID + " -->", _repl.replace(/\n\t$/,''));

      templatesResolved[tpl][MARKUP_ID] = markup.replace(/\n{3,}/g,"\n\n");
      delete templatesResolved[tpl][STYLE_ID]; 
      delete templatesResolved[tpl][SCRIPT_ID]; 
      
      fs.writeFileSync(this.templateDir + tpl + DOT + MARKUP_EXT, templatesResolved[tpl][MARKUP_ID]);
    }
    
    if (this.debug) {
      fs.writeFileSync(this.folders.debug.root + NAME + '_dependencies.json', JSON.stringify(dependencies, true, INDENT));
      fs.writeFileSync(this.folders.debug.root + NAME + '_templatesResolved.json', JSON.stringify(templatesResolved, true, INDENT));  
    }
    return;
  }
  
  _getObjects (dir, baseDir, markupName = 'html', data = {}) {
    let files = fs.readdirSync(dir);
    for (let f in files){
      let name = dir + files[f];
      if (fs.statSync(name).isDirectory()){
        this._getObjects(name + SLASH, baseDir, markupName, data);
      } else {
        let regEx1 = new RegExp(DOT + markupName + LINE_END, '');
        let regEx2 = new RegExp(this.layout.object_types.global + DOT + markupName + LINE_END, '');
        if (name.match(regEx1) && !name.match(regEx2)) {
          let fileContent = fs.readFileSync(name, UTF8);
          let filePath = name.replace(baseDir, '');
          data[filePath] = fileContent;
        }
      }
    }
    if (this.debug) {
      fs.writeFileSync(this.folders.debug.root + NAME + '_data.json', JSON.stringify(data, true, INDENT));
    }
    return data;
  }
  
  _makeObjectTypes (baseDir, data = {}) {
    let objects = {};
    for (let fileName in data) {
      let [type,name,file] = fileName
                    .replace(path.sep, SLASH)
                    .replace(baseDir, '')
                    .split(SLASH)
                    .filter(Boolean);
      let pathToObject = baseDir + type + SLASH + name + SLASH;
      

      if (!(type in objects)) {
          objects[type] = {};
      }

      if (!(name in objects[type])) {
        objects[type][name] = new Object();
        objects[type][name][this.layout.identifiers.markup] =  data[fileName]
                                                                .replace(/\r\n/g,"\n")
                                                                .replace(/\r/g,"\n")
                                                                .replace(/\n{3,}/g,"\n\n")
        try {
            fs.openSync(pathToObject + name + DOT + this.layout.file_extensions.style, READONLY);
            objects[type][name][this.layout.file_extensions.style] = 1;
        } catch(e) {}

        try {
            fs.openSync(pathToObject + name + DOT + this.layout.file_extensions.script, READONLY);
            objects[type][name][this.layout.file_extensions.script] = 1;
        } catch(e) {}
      }
    }
    
    if (this.debug) {
        fs.writeFileSync(this.folders.debug.root + NAME + '_objects.json', JSON.stringify(objects, true, INDENT));
    }
    return objects;
  }
  
  updateTemplates(filePath, eventType) {
    let regEx = new RegExp(BACKSLASH + path.sep, 'g');
    let parts = filePath
                  .replace(regEx, SLASH)
                  .replace(baseDir, '')
                  .split(SLASH)
                  .filter(Boolean);
    
    let type = '';
    for (let t in this.layout.object_types) {
      if (this.layout.object_types[t] === parts[0]) {
        type = parts[0] + HYPHEN;
      }
    }

    let tmp,name,ext;
    if (parts.length < 2) {
        tmp = parts[0].split(DOT);
        name = tmp[0];
        ext = tmp[1];
    } else {
        name = parts[parts.length - 2];
        tmp = parts[parts.length - 1].split(DOT);
        ext = tmp[1];
    }           

    let updateTemplates = [];
    if (typeof this.dependencies[type+name] !== 'undefined') {
        if (ext === this.layout.file_extensions.markup
            || ((ext === this.layout.file_extensions.style || ext === this.layout.file_extensions.script) 
                 && (eventType === CREATE || eventType === DELETE)))
        {
            updateTemplates = this.dependencies[type+name];
        } 
    }
      if (updateTemplates.length > 0) {
        // Delete templates: remove dependency
        // Add template: parse it, add dependencies
        this.preprocessTemplates();
        
        if (this.debug) {
          console.log(eventType + ' => ' + name + DOT + ext + ', generating templates for: ' + updateTemplates.join(', '));
        }
      }
      return;
  }

}

module.exports = TemplatePreprocessor;
