var mongoose = require('mongoose');
var ShortId = require('./shortid');

/**
 * Monkey patch the mongoose save function
 * Because save is now a more complex promise, need to go lower to the internal save
 * Throw on any obvious changes to the internal save prototype
 */
var defaultSaveName = '$__save';
var defaultSave = mongoose.Model.prototype[defaultSaveName];
(function checkDefaultSave() {
  var defaultSaveLength = 2;
  if (typeof defaultSave!=='function') {
    throw new Error('mongoose no longer supports the prototype '+defaultSaveName);
  }
  if (defaultSave.length!==defaultSaveLength) {
    throw new Error('mongoose prototype '+defaultSaveName+' arity has changed from '+defaultSaveLength+' to '+defaultSave.length);
  }
})();

mongoose.Model.prototype[defaultSaveName] = function(options,cb) {
  for (var fieldName in this.schema.tree) {
    if (this.schema.tree.hasOwnProperty(fieldName) && this.isNew && !this[fieldName]) {
      var idType = this.schema.tree[fieldName];

      if (idType === ShortId || idType.type === ShortId) {
        var idInfo = this.schema.path(fieldName);
        var retries = idInfo.retries;
        var self = this;
        function attemptSave() {
          idInfo.generator(idInfo.generatorOptions, function(err, id) {
            if (err) {
              cb(err);
              return;
            }
            self[fieldName] = id;
            defaultSave.call(self, options, function(err, obj) {
              if (err &&
                            err.code == 11000 &&
                  (err.err || err.errmsg || '').indexOf(fieldName) !== -1 &&
                            retries > 0
                 ) {
                --retries;
                attemptSave();
              } else {
                // TODO check these args
                cb(err, obj);
              }
            });
          });
        }
        attemptSave();
        return;
      }
    }
  }
  defaultSave.call(this, options, cb);
};

module.exports = exports = ShortId;
