var fs = require('fs')
  , locales = JSON.parse(fs.readFileSync('./locale/locale.json', 'utf8'))
  , currencies = JSON.parse(fs.readFileSync('./locale/currencies.json', 'utf8'))
  , countries = JSON.parse(fs.readFileSync('./locale/countries.json', 'utf8'))
  , countryCodes = JSON.parse(fs.readFileSync('./locale/countryCodes.json', 'utf8'))

exports.locales = locales
exports.currencies = currencies
exports.countries = countries
exports.countryCodes = countryCodes

exports.getPerfionLocale = (locale) => {
  var result = locales.locales.find((item) => {return item.locale == locale})
  var defaultLocale = locales.locales.find((item) => {return item.locale == 'en'})
  return result && result['perfion'] ? result['perfion'] : defaultLocale['perfion'] 
}

exports.findLocale = findLocale

function findLocale(entity, locale, type) {
  if(entity && entity[locale]) {
    return entity[locale]
  }
  else if(locale == 'EN' || locale == 'en') {
    return 'n/a'
  }
  else {
    if(typeof(entity) != 'object') {
      return entity
    }
    else if(entity[locale]) {
      return entity[locale]
    }
    else {
      // TODO get fallback and test...
      var fallback_locale = type == 'perfion' ? 'EN' : 'en'
      return findLocale(entity, fallback_locale, type)
    }  
  }  
}