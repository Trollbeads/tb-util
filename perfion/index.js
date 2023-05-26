var xml2js = require('xml2js')
    , soap = require('soap')
    , _ = require('underscore')
    , fs = require('fs')

function executeQuery(debug, wsdl_uri, query, _callback, format) {
    var start = undefined
    if (debug) {
        start = new Date().getTime()
    }

    soap.createClient(wsdl_uri, function (err, client) {
        if (err) { console.log(err) }

        client.ExecuteQuery({ query: query }, function (err, result) {
            if (err) {
                //  console.log(err)

                var parser = xml2js.Parser()
                parser.parseString(err.body, function (err, result) {
                    if (result['soap:Envelope']) {
                        var faultString = result['soap:Envelope']['soap:Body'][0]['soap:Fault'][0].faultstring[0]

                        if (faultString.indexOf("Trying to assign a value to the feature 'Price") != -1 && faultString.indexOf("Retail' on a child") != -1) {
                            //    console.log('inherited error Price Retail')
                            _callback({ err: true, message: "Can't assign an inherited feature to Price Retail." })
                        } else if (faultString.indexOf("Trying to assign a value to the feature 'Price") != -1 && faultString.indexOf("Wholesale' on a child") != -1) {
                            //    console.log('inherited error Price Wholesale')
                            _callback({ err: true, message: "Can't assign an inherited feature to Price Wholesale." })
                        }
                        else if (faultString.indexOf("Trying to assign a value to the feature 'Description'") != -1) {
                            //    console.log('inherited error Description')
                            _callback({ err: true, message: "Can't assign an inherited feature to Description." })
                        }
                    }
                    else {
                        setTimeout(() => {
                            executeQuery(query, _callback)
                        }, 30000)
                    }
                })
            }
            else{
                if(debug){
                    console.log((new Date().getTime() - start) + 'ms for query to run')
                }
                if (format == 'xml') {
                    _callback(result.ExecuteQueryResult)
                }
                else {
                    convertXMLtoJSON(result.ExecuteQueryResult, _callback)
                }
            }
        })
    })
}

function convertXMLtoJSON(debug, xml, _callback) {
    var start = undefined
    if (debug) {
        start = new Date().getTime()
    }
    var parser = xml2js.Parser()
    parser.parseString(xml, function (err, result) {
        if (err) {
            //console.log(result)
            console.log(err)
        }
        if (debug) {
            console.log((new Date().getTime() - start) + 'ms for xml to json conversion')
        }
        _callback(result)
    })
}

function fullFeature(id, languages, _callback) {
    fs.readFile('./perfion/query.xml', 'utf8', function (err, query) {
        query = query.replace('{{feature}}', id)
        query = query.replace('{{language}}', languages)
        executeQuery(query, _callback)
    })
}

exports.executeQuery = function (query, _callback, format) {
  executeQuery(query, _callback, format)
}

exports.executeQueryFromFile = function (filename, _callback, format) {
  fs.readFile('./perfion/' + filename + '.xml', 'utf8', function (err, query) {
    executeQuery(query, _callback, format)
  })
}

exports.fullFeature = function (id, languages, _callback) {
    fullFeature(id, languages, _callback)
}

exports.getImageById = function (image_uri, id, width, height) {
    return image_uri + '?id=' + id + '&size=' + (width ? width : 200) + 'x' + (height ? height : 200) + '&format=jpg'
}

exports.productGuide = function (file, _callback) {
    fs.readFile('./perfion/' + file, 'utf8', async function (err, query) { // product-guide.xml
        query = await query.replace('{{language}}', 'EN')
        executeQuery(query, async function (results) {
            result = await results
            _callback(result.Data.ProductGuides)
        })
    })
}

exports.productsBeforeFiltering = function (languages, file, _callback) {
    fs.readFile('./perfion/' + file, 'utf8', async function (err, query) { // product-invoice.xml
        query = await query.replace('{{language}}', languages)
        executeQuery(query, async function (results) {
            result = await results
            _callback(result.Data.Product)
        })
    })
}

exports.product = function (languages, file, _callback, sku, language_filter) { //product.xml
    fs.readFile('./perfion/' + file, 'utf8', function (err, query) {
        query = query.replace('{{language}}', languages)
        query = query
            .replace('{{language_filter}}', language_filter)
            .replace('{{language_filter}}', language_filter)
        if (sku) {
            query = query.replace('{{sku}}', sku)
        }
        executeQuery(query, async function (result) {
            var data = []
            results = await result

            _.each(results.Data.Product, function (entity) {
                var product = {}
                _.each(entity, function (attribute, key) {
                    if (key == '$') {
                        product.id = attribute.id
                        product.order = attribute.order
                    }
                    else if (key == 'Value') {
                        product.name = {}
                        _.each(attribute, function (item) {
                            language = item['$'].language
                            itemValue = item._
                            product.name[language] = itemValue
                        })
                    }
                    else if (key == 'Collection') {
                        product.Collection = {}
                        _.each(attribute, function (item) {
                            language = item['$'].language
                            product.Collection[language] = item._
                        })
                    }
                    else if (key == 'Category') {
                        product.Category = {}
                        _.each(attribute, function (item) {
                            language = item['$'].language
                            product.Category[language] = item._
                        })
                    }
                    else if (key == 'Description') {
                        product.Description = {}
                        _.each(attribute, function (item) {
                            language = item['$'].language
                            product.Description[language] = item._
                        })
                    }
                    else if (key == 'VariantGroupName') {
                        product.VariantGroupName = {}
                        _.each(attribute, function (item) {
                            language = item['$'].language
                            product.VariantGroupName[language] = item._
                        })
                    }
                    else if (key == 'Color') {
                        product[key] = {}
                        _.each(attribute, function (item) {
                            language = item['$'].language
                            product[key][language] = item._
                        })
                    }
                    else if (key == 'Designer') {
                        product[key] = {}
                        _.each(attribute, function (item) {
                            product[key].name = item._
                            product[key].id = item['$'].id
                        })
                    }
                    else if (key == 'AdditionalImages') {
                        attributeArray = []
                        _.each(attribute, function (item) {
                            id = item._
                            seq = item['$'].seq
                            filename = item['$'].string
                            attributeArray.push({ id, seq, filename })
                        })
                        product[key] = attributeArray
                    }
                    else if (key == 'Image') {
                        attributeArray = []
                        _.each(attribute, function (item) {
                            id = item._
                            filename = item['$'].string
                            attributeArray.push({ id, filename })
                        })
                        product[key] = attributeArray
                    }
                    else if (key == 'Keyword') {
                        english_keywords = []
                        english_us_keywords = []
                        danish_keywords = []
                        russian_keywords = []
                        product[key] = {}
                        _.each(attribute, function (item) {
                            if (item['$'].language == 'EN') {
                                english_keywords.push(item._)
                                product[key]['EN'] = english_keywords
                            }
                            else if (item['$'].language == 'ENU') {
                                english_us_keywords.push(item._)
                                product[key]['ENU'] = english_us_keywords
                            }
                            else if (item['$'].language == 'DAN') {
                                danish_keywords.push(item._)
                                product[key]['DAN'] = danish_keywords
                            }
                            else if (item['$'].language == 'RUS') {
                                russian_keywords.push(item._)
                                product[key]['RUS'] = russian_keywords
                            }
                        })
                    }
                    else if (key == 'TrollbeadspartnerCategory' || key == 'AdditionalTrollbeadspartnerCategory') {

                    }
                    else if(key == 'Theme') {
                        var values = []
                        _.each(attribute, function (item) {
                            values.push(item._ )
                        })
                        product[key] = values                       
                    }
                    else {
                        _.each(attribute, function (item) {
                            product[key] = item._
                        })
                    }

                })
                data.push(product)
            })

            _callback(data)
        })
    })
}



exports.productTranslate = function (currency, languages, file, _callback, sku, language_filter) { //product.xml
    fs.readFile('./perfion/' + file, 'utf8', function (err, query) {

        if (currency) {
            query = query.replace('{{currency}}', currency)
        }
        query = query.replace('{{language}}', languages)
        query = query
            .replace('{{language_filter}}', language_filter)
            .replace('{{language_filter}}', language_filter)
        if (sku) {
            query = query.replace('{{sku}}', sku)
        }
        executeQuery(query, async function (result) {
            var data = []
            results = await result

            _.each(results.Data.Product, function (entity) {
                var product = {}
                _.each(entity, function (attribute, key) {
                    if (key == '$') {
                        product.id = attribute.id
                        product.order = attribute.order
                        product.createdDate= attribute.createdDate
                        product.modifiedDate= attribute.modifiedDate
                    }
                    else if (key == 'Value') {
                        product.name = {}
                        _.each(attribute, function (item) {
                            language = item['$'].language
                            itemValue = item._
                            product.name[language] = itemValue
                        })
                    }
                    else if (key == 'Collection') {
                        product.Collection = {}
                        _.each(attribute, function (item) {
                            language = item['$'].language
                            product.Collection[language] = item._
                        })
                    }
                    else if (key == 'Category') {
                        product.Category = {}
                        _.each(attribute, function (item) {
                            language = item['$'].language
                            product.Category[language] = item._
                        })
                    }
                    else if (key == 'Description') {
                        product.Description = {}
                        _.each(attribute, function (item) {
                            language = item['$'].language
                            product.Description[language] = item._
                        })
                    }
                    else if (key == 'VariantGroupName') {
                        product.VariantGroupName = {}
                        _.each(attribute, function (item) {
                            language = item['$'].language
                            product.VariantGroupName[language] = item._
                        })
                    }
                    else if (key == 'Color') {
                        product[key] = {}
                        _.each(attribute, function (item) {
                            language = item['$'].language
                            product[key][language] = item._
                        })
                    }
                    else if (key == 'Designer') {
                        product[key] = {}
                        _.each(attribute, function (item) {
                            product[key].name = item._
                            product[key].id = item['$'].id
                        })
                    }
                    else if (key == 'AdditionalImages') {
                        attributeArray = []
                        _.each(attribute, function (item) {
                            id = item._
                            seq = item['$'].seq
                            filename = item['$'].string
                            attributeArray.push({ id, seq, filename })
                        })
                        product[key] = attributeArray
                    }
                    else if (key == 'Image') {
                        attributeArray = []
                        _.each(attribute, function (item) {
                            id = item._
                            filename = item['$'].string
                            attributeArray.push({ id, filename })
                        })
                        product[key] = attributeArray
                    }
                    else if (key == 'Keyword') {
                        english_keywords = []
                        english_us_keywords = []
                        danish_keywords = []
                        russian_keywords = []
                        product[key] = {}
                        _.each(attribute, function (item) {
                            if (item['$'].language == 'EN') {
                                english_keywords.push(item._)
                                product[key]['EN'] = english_keywords
                            }
                            else if (item['$'].language == 'ENU') {
                                english_us_keywords.push(item._)
                                product[key]['ENU'] = english_us_keywords
                            }
                            else if (item['$'].language == 'DAN') {
                                danish_keywords.push(item._)
                                product[key]['DAN'] = danish_keywords
                            }
                            else if (item['$'].language == 'RUS') {
                                russian_keywords.push(item._)
                                product[key]['RUS'] = russian_keywords
                            }
                        })
                    }
                    else if (key == 'TrollbeadspartnerCategory' || key == 'AdditionalTrollbeadspartnerCategory') {

                    }
                    else {
                        _.each(attribute, function (item) {
                            product[key] = item._
                        })
                    }

                })
                data.push(product)
            })

            _callback(data)
        })
    })
}


exports.product2 = function (languages, file, _callback) { //product.xml
    fs.readFile('./perfion/' + file, 'utf8', function (err, query) {
        query = query.replace('{{language}}', languages)
        executeQuery(query, async function (result) {
            var data = []
            results = await result

            _.each(results.Data.Product, function (entity) {

                var product = {}
                _.each(entity, function (attribute, key) {
                    if (key == '$') {
                        product.id = attribute.id
                        product.order = attribute.order
                    }
                    else if (key == 'Value') {
                        product.name = {}
                        _.each(attribute, function (item) {
                            language = item['$'].language
                            itemValue = item._
                            product.name[language] = itemValue
                        })
                    }
                    else if (key == 'Collection') {
                        product.Collection = {}
                        _.each(attribute, function (item) {
                            language = item['$'].language
                            product.Collection[language] = item._
                        })
                    }
                    else if (key == 'Description') {
                        product.Description = {}
                        _.each(attribute, function (item) {
                            language = item['$'].language
                            product.Description[language] = item._
                        })
                    }
                    else if (key == 'Color') {
                        product[key] = {}
                        _.each(attribute, function (item) {
                            language = item['$'].language
                            product[key][language] = item._
                        })
                    }
                    else if (key == 'Designer') {
                        product[key] = {}
                        _.each(attribute, function (item) {
                            product[key].name = item._
                            product[key].id = item['$'].id
                        })
                    }
                    else if (key == 'AdditionalImages') {
                        attributeArray = []
                        _.each(attribute, function (item) {
                            id = item._
                            seq = item['$'].seq
                            filename = item['$'].string
                            attributeArray.push({ id, seq, filename })
                        })
                        product[key] = attributeArray
                    }
                    else if (key == 'Image') {
                        attributeArray = []
                        _.each(attribute, function (item) {
                            id = item._
                            filename = item['$'].string
                            attributeArray.push({ id, filename })
                        })
                        product[key] = attributeArray
                    }
                    else if (key == 'Keyword') {
                        english_keywords = []
                        english_us_keywords = []
                        danish_keywords = []
                        russian_keywords = []
                        product[key] = {}
                        _.each(attribute, function (item) {
                            if (item['$'].language == 'EN') {
                                english_keywords.push(item._)
                                product[key]['EN'] = english_keywords
                            }
                            else if (item['$'].language == 'ENU') {
                                english_us_keywords.push(item._)
                                product[key]['ENU'] = english_us_keywords
                            }
                            else if (item['$'].language == 'DAN') {
                                danish_keywords.push(item._)
                                product[key]['DAN'] = danish_keywords
                            }
                            else if (item['$'].language == 'RUS') {
                                russian_keywords.push(item._)
                                product[key]['RUS'] = russian_keywords
                            }
                        })
                    }
                    else if (key == 'TrollbeadspartnerCategory' || key == 'AdditionalTrollbeadspartnerCategory') {

                    }
                    else {
                        _.each(attribute, function (item) {
                            product[key] = item._
                        })
                    }

                })
                data.push(product)
            })

            _callback(data)
        })
    })
}

exports.productForTbp = function (languages, file, _callback) { //product.xml
    fs.readFile('./perfion/' + file, 'utf8', function (err, query) {
        query = query.replace('{{language}}', languages)
        productsFromQuery(query, _callback)
    })
}

exports.productsFromQuery = function (query, _callback) {
    productsFromQuery(query, _callback)
}

function productsFromQuery(query, _callback) {
    executeQuery(query, async function (result) {
        var data = []
        results = await result

        _.each(results.Data.Product, (entity) => {

            var product = {}
            _.each(entity, (attribute, key) => {
                if (key == '$') {
                    product.Id = attribute.id
                }
                else if (key == 'Value') {
                    product.Name = {}
                    _.each(attribute, function (item) {
                        language = item['$'].language
                        product.Name[language] = item._
                    })
                }
                else if (key == 'Category' || key == 'Color' || key == 'Keyword' || key == 'AdditionalMaterial') {
                    product[key] = {}
                    _.each(attribute, function (item) {
                        language = item['$'].language

                        if(!Array.isArray(product[key][language])) {
                            product[key][language] = []
                        }

                        product[key][language].push(item._)
                    })
                }
                else if (key == 'Collection' || key == 'Description' || key == 'MainMaterial') {
                    product[key] = {}
                    _.each(attribute, function (item) {
                        language = item['$'].language
                        product[key][language] = item._
                    })
                }
                else if (key == 'Designer') {
                    product[key] = {}
                    _.each(attribute, function (item) {
                        product[key] = item._
                    })
                }
                else if (key == 'AdditionalImages') {
                    attributeArray = []
                    _.each(attribute, function (item) {
                        id = item._
                        seq = item['$'].seq
                        filename = item['$'].string
                        attributeArray.push({ id, seq, filename })
                    })
                    product[key] = attributeArray
                }
                else if (key == 'Image') {
                    attributeArray = []
                    _.each(attribute, function (item) {
                        id = item._
                        filename = item['$'].string
                        attributeArray.push({ id, filename })
                    })
                    product[key] = attributeArray
                }
                else {
                    _.each(attribute, function (item) {
                        product[key] = item._
                    })
                }

            })
            data.push(product)
        })

        _callback(data, result.Data.Features[0])
    })
}

exports.productForDW = function (languages, file, _callback) { //product-dw.xml
    fs.readFile('./perfion/' + file, 'utf8', function (err, query) {
        query = query.replace('{{language}}', 'EN')
        executeQuery(query, async function (result) {
            var data = []
            results = await result
            // console.log(results.Data.Product[0])
            _.each(results.Data.Product, function (entity) {

                var product = {}
                _.each(entity, function (attribute, key) {
                    if (key == '$') {
                        product.id = attribute.id
                        product.order = attribute.order
                        product.modifiedDate = attribute.modifiedDate
                        product.modifiedDateDiff = new Date(attribute['modifiedDate']) - new Date('1900-01-01')
                        product.sourceId = 30
                    }
                    else if (key == 'Value') {
                        product.name = {}
                        _.each(attribute, function (item) {
                            itemValue = item._
                            product.name = itemValue
                        })
                    }

                    else if (key == 'Keyword') {
                        english_keywords = []
                        product[key] = {}
                        _.each(attribute, function (item) {
                            if (item['$'].language == 'EN') {
                                english_keywords.push(item._)
                                product[key] = english_keywords
                            }
                        })
                    }
                    else if (key == 'AdditionalImages' || key == 'Image' || key == 'AdditionalTrollbeadspartnerCategory') {

                    }
                    else {
                        _.each(attribute, function (item) {
                            product[key] = item._
                        })
                    }
                })
                data.push(product)
            })

            _callback(data)
        })
    })
}

function mapMultipleValues(entity) {
    productAttribute = {}
    if (entity.Value) {
        _.each(entity.Value, function (item) {
            language = item['$'].language
            itemValue = item._
            productAttribute[language] = itemValue
        })
    }
    return productAttribute
}

exports.productForAmazon = function (languages, file, _callback) { //amazon.xml
    fs.readFile('./perfion/' + file, 'utf8', function (err, query) {
        query = query.replace('{{language}}', languages)
        executeQuery(query, async function (result) {
            var data = []
            results = await result

            _.each(results.Data.Product, function (entity) {

                var product = {}
                _.each(entity, function (attribute, key) {
                    if (key == '$') {
                        product.id = attribute.id
                        product.order = attribute.order
                    }
                    else if (key == 'Value') {
                        product.name = {}
                        _.each(attribute, function (item) {
                            language = item['$'].language
                            itemValue = item._
                            product.name[language] = itemValue
                        })
                    }
                    else if (key == 'MainMaterial') {
                        product.MainMaterial = {}
                        _.each(attribute, function (item) {
                            language = item['$'].language
                            itemValue = item._
                            product.MainMaterial[language] = itemValue
                        })
                    }
                    else if (key == 'AdditionalMaterial') {
                        product.AdditionalMaterial = {}
                        _.each(attribute, function (item) {
                            language = item['$'].language
                            itemValue = item._
                            product.AdditionalMaterial[language] = itemValue
                        })
                    }
                    else if (key == 'VariantGroupSKU' && attribute != undefined) {
                        product.VariantGroupSKU = attribute[0]._
                    }
                    else if (key == 'Collection') {
                        product.Collection = {}
                        _.each(attribute, function (item) {
                            language = item['$'].language
                            product.Collection[language] = item._
                        })
                    }
                    else if (key == 'Description') {
                        product.Description = {}
                        _.each(attribute, function (item) {
                            language = item['$'].language
                            product.Description[language] = item._
                        })
                    }
                    else if (key == 'Color') {
                        product[key] = {}
                        _.each(attribute, function (item) {
                            language = item['$'].language
                            product[key][language] = item._
                        })
                    }
                    else if (key == 'Designer') {
                        product[key] = {}
                        _.each(attribute, function (item) {
                            product[key].name = item._
                            product[key].id = item['$'].id
                        })
                    }
                    else if (key == 'AdditionalImages') {
                        attributeArray = []
                        _.each(attribute, function (item) {
                            id = item._
                            seq = item['$'].seq
                            filename = item['$'].string
                            attributeArray.push({ id, seq, filename })
                        })
                        product[key] = attributeArray
                    }
                    else if (key == 'Image') {
                        attributeArray = []
                        _.each(attribute, function (item) {
                            id = item._
                            filename = item['$'].string
                            attributeArray.push({ id, filename })
                        })
                        product[key] = attributeArray
                    }
                    else if (key == 'TrollbeadspartnerCategory' || key == 'AdditionalTrollbeadspartnerCategory') {

                    }
                    else {
                        _.each(attribute, function (item) {
                            product[key] = item._
                        })
                    }

                })
                data.push(product)
            })

            _callback(data)
        })
    })
}

exports.AvailibilityException = function (type, languages, _callback) {
    fullFeature(type, languages, function (result) {
        console.log(result.Data.AvailibilityRetailExeption[0].Distributor[0])
        console.log(result.Data.AvailibilityRetailExeption[0].Product[0])
        var data = []

        _.each(result.Data[type], function (entity) {
            data.push({
                id: entity['$'].id,
                order: entity['$'].order,
                value: entity.Value ? entity.Value[0]._ : undefined,
                availiblityDateExeptionStart: entity.AvailiblityDateExeptionStart ? entity.AvailiblityDateExeptionStart[0]._ : undefined,
                availiblityDateExeptionEnd: entity.AvailiblityDateExeptionEnd ? entity.AvailiblityDateExeptionEnd[0]._ : undefined,
                distributor: entity.Distributor ? entity.Distributor[0]._ : undefined,
                product: entity.Product ? entity.Product[0]._ : undefined
            })
        })

        _callback(data)
    })
}

exports.BangleSize = function (languages, _callback) {
    fullFeature('BangleSize', languages, function (result) {
        var data = []

        _.each(result.Data.BangleSize, function (entity) {
            data.push({
                id: entity['$'].id,
                order: entity['$'].order,
                value: entity.Value ? entity.Value[0]._ : undefined
            })
        })

        _callback(data)
    })
}

exports.BaseUnitOfMeasure = function (languages, _callback) {
    fullFeature('BaseUnitOfMeasure', languages, function (result) {
        var data = []

        _.each(result.Data.BaseUnitOfMeasure, function (entity) {
            data.push({
                id: entity['$'].id,
                order: entity['$'].order,
                value: entity.Value ? entity.Value[0]._ : undefined
            })
        })

        _callback(data)
    })
}

exports.BillOfMaterial = function (languages, _callback) {
    fullFeature('BillOfMaterial', languages, function (result) {
        var data = []

        _.each(result.Data.BillOfMaterial, function (entity) {
            data.push({
                id: entity['$'].id,
                order: entity['$'].order,
                value: entity.Value ? entity.Value[0]._ : undefined,
                bomComponent: entity.BomComponent ? entity.BomComponent[0]._ : undefined,
                importedToDK: entity.ImportedToDK ? entity.ImportedToDK[0]._ : undefined,
                importedToNAV: entity.ImportedToNAV ? entity.ImportedToNAV[0]._ : undefined,
                importedToUK: entity.ImportedToUK ? entity.ImportedToUK[0]._ : undefined,
                importedToUS: entity.ImportedToUS ? entity.ImportedToUS[0]._ : undefined,
                importedToXJ: entity.ImportedToXJ ? entity.ImportedToXJ[0]._ : undefined,
                product: entity.Product ? entity.Product[0]._ : undefined,
                quantity: entity.Quantity ? entity.Quantity[0]._ : undefined
            })
        })

        _callback(data)
    })
}

exports.BrandName = function (languages, _callback) {
    fullFeature('BrandName', languages, function (result) {
        var data = []

        _.each(result.Data.BrandName, function (entity) {
            data.push({
                id: entity['$'].id,
                order: entity['$'].order,
                value: entity.Value ? entity.Value[0]._ : undefined,
                brandDimensionCode: entity.BrandDimensionCode ? entity.BrandDimensionCode[0]._ : undefined
            })
        })

        _callback(data)
    })
}

exports.CategoryGroup = function (languages, _callback) {
    fullFeature('CategoryGroup', languages, function (result) {
        var data = []

        _.each(result.Data.Features[0].CategoryGroup[0], function (entity) {
            data.push({
                id: entity.id ? entity.id : undefined,
                language: entity.language ? entity.language : undefined,
                caption: entity.caption ? entity.caption : undefined,
                captionAlternative: entity.captionAlternative ? entity.captionAlternative : undefined,
                unit: entity.unit ? entity.unit : undefined,
                abbr: entity.abbr ? entity.abbr : undefined,
                group: entity.group ? entity.group : undefined,
                groupOrder: entity.groupOrder ? entity.groupOrder : undefined,
                viewGroup: entity.viewGroup ? entity.viewGroup : undefined,
                viewGroupOrder: entity.viewGroupOrder ? entity.viewGroupOrder : undefined,
                viewOrder: entity.viewOrder ? entity.viewOrder : undefined,
                form: entity.form ? entity.form : undefined,
                dataType: entity.dataType ? entity.dataType : undefined,
            })
        })

        _callback(data)
    })
}

exports.Collection = function (languages, _callback) {
    fullFeature('Collection', languages, function (result) {
        var data = []

        _.each(result.Data.Collection, function (entity) {
            data.push({
                id: entity['$'].id,
                order: entity['$'].order,
                value: entity.Value ? entity.Value[0]._ : undefined,
                collectionDimensionCode: entity.Product ? entity.Product[0]._ : undefined
            })
        })

        _callback(data)
    })
}

exports.Color = function (languages, _callback) {
    fullFeature('Color', languages, function (result) {
        var data = []

        _.each(result.Data.Color, function (entity) {

            data.push({
                id: entity['$'].id,
                order: entity['$'].order,
                value: entity.Value ? mapMultipleValues(entity) : undefined
            })
        })

        _callback(data)
    })
}

exports.AdditionalMaterial = function (languages, _callback) {
    fullFeature('AdditionalMaterial', languages, function (result) {
        var data = []

        _.each(result.Data.MainMaterial, function (entity) {

            data.push({
                id: entity['$'].id,
                order: entity['$'].order,
                value: entity.Value ? mapMultipleValues(entity) : undefined
            })
        })

        _callback(data)
    })
}

exports.CountryOfOrigin = function (languages, _callback) {
    fullFeature('CountryOfOrigin', languages, function (result) {
        var data = []

        _.each(result.Data.CountryOfOrigin, function (entity) {
            data.push({
                id: entity['$'].id,
                order: entity['$'].order,
                value: entity.Value ? entity.Value[0]._ : undefined
            })
        })

        _callback(data)
    })
}

exports.CustomsTariff = function (languages, _callback) {
    fullFeature('CustomsTariff', languages, function (result) {
        var data = []
        _.each(result.Data.CustomsTariff, function (entity) {
            data.push({
                id: entity['$'].id,
                order: entity['$'].order,
                value: entity.Value ? entity.Value[0]._ : undefined,
                customsTariffDescription: entity.CustomsTariffDescription ? entity.CustomsTariffDescription[0]._ : undefined
            })
        })

        _callback(data)
    })
}

exports.Designer = function (languages, _callback) {
    fullFeature('Designer', languages, function (result) {
        var data = []

        _.each(result.Data.Designer, function (entity) {
            data.push({
                id: entity['$'].id,
                order: entity['$'].order,
                value: entity.Value ? entity.Value[0]._ : undefined,
                designerContentId: entity.DesignerContentId ? entity.DesignerContentId[0]._ : undefined
            })
        })

        _callback(data)
    })
}

exports.DiamondClarityName = function (languages, _callback) {
    fullFeature('DiamondClarityName', languages, function (result) {
        var data = []

        _.each(result.Data.DiamondClarityName, function (entity) {
            data.push({
                id: entity['$'].id,
                order: entity['$'].order,
                value: entity.Value ? entity.Value[0]._ : undefined
            })
        })

        _callback(data)
    })
}

exports.DiamondColor = function (languages, _callback) {
    fullFeature('DiamondColor', languages, function (result) {
        var data = []

        _.each(result.Data.DiamondColor, function (entity) {
            data.push({
                id: entity['$'].id,
                order: entity['$'].order,
                value: entity.Value ? entity.Value[0]._ : undefined
            })
        })

        _callback(data)
    })
}

exports.DiamondCut = function (languages, _callback) {
    fullFeature('DiamondCut', languages, function (result) {
        var data = []

        _.each(result.Data.DiamondCut, function (entity) {
            data.push({
                id: entity['$'].id,
                order: entity['$'].order,
                value: entity.Value ? entity.Value[0]._ : undefined
            })
        })

        _callback(data)
    })
}

exports.Distributor = function (languages, _callback) {
    fullFeature('Distributor', languages, function (result) {
        var data = []

        _.each(result.Data.Distributor, function (entity) {
            data.push({
                id: entity['$'].id,
                order: entity['$'].order,
                value: entity.Value ? entity.Value[0]._ : undefined,
                distributorId: entity.DistributorId ? entity.DistributorId[0]._ : undefined
            })
        })

        _callback(data)
    })
}

exports.facetMaterial = function (languages, _callback) {
    fullFeature('facetMaterial', languages, function (result) {
        var data = []

        _.each(result.Data.FacetMaterial, function (facet) {
            data.push({
                order: facet['$'].order,
                value: facet.Value ? facet.Value[0]._ : undefined,
                showFacetOnWeb: facet.ShowFacetOnWeb ? (facet.ShowFacetOnWeb[0]._ == 'true' ? true : false) : false
            })
        })

        _callback(data)
    })
}

exports.ItemGroup = function (languages, _callback) {
    fullFeature('ItemGroup', languages, function (result) {
        var data = []

        _.each(result.Data.ItemGroup, function (entity) {
            data.push({
                id: entity['$'].id,
                order: entity['$'].order,
                value: entity.Value ? entity.Value[0]._ : undefined,
                itemGroupDimensionCode: entity.ItemGroupDimensionCode ? entity.ItemGroupDimensionCode[0]._ : undefined
            })
        })

        _callback(data)
    })
}

exports.Keyword = function (languages, _callback) {
    fullFeature('Keyword', languages, function (result) {
        var data = []

        _.each(result.Data.Keyword, function (entity) {
            data.push({
                id: entity['$'].id,
                order: entity['$'].order,
                value: entity.Value ? entity.Value[0]._ : undefined
            })
        })

        _callback(data)
    })
}

exports.MainMaterial = function (languages, _callback) {
    fullFeature('MainMaterial', languages, function (result) {
        var data = []

        _.each(result.Data.MainMaterial, function (entity) {
            data.push({
                id: entity['$'].id,
                order: entity['$'].order,
                value: entity.Value ? mapMultipleValues(entity) : undefined,
                facetMaterial: entity.FacetMaterial ? entity.FacetMaterial[0]._ : undefined,
                materialDimensionCode: entity.MaterialDimensionCode ? entity.MaterialDimensionCode[0]._ : undefined
            })
        })

        _callback(data)
    })
}

exports.Occasion = function (languages, _callback) {
    fullFeature('Occasion', languages, function (result) {
        var data = []

        _.each(result.Data.Occasion, function (entity) {
            data.push({
                id: entity['$'].id,
                order: entity['$'].order,
                value: entity.Value ? entity.Value[0]._ : undefined
            })
        })

        _callback(data)
    })
}

exports.PriceGroup = function (languages, _callback) {
    fullFeature('PriceGroup', languages, function (result) {
        var data = []

        _.each(result.Data.PriceGroup, function (entity) {
            data.push({
                id: entity['$'].id,
                order: entity['$'].order,
                value: entity.Value ? entity.Value[0]._ : undefined
            })
        })

        _callback(data)
    })
}
exports.Category = function (languages, _callback) {
    fullFeature('Category', languages, function (result) {
        var data = []

        _.each(result.Data.Category, function (entity) {
            data.push({
                id: entity['$'].id,
                order: entity['$'].order,
                value: entity.Value ? entity.Value[0]._ : undefined
            })
        })

        _callback(data)
    })
}

exports.ProductBannerCssClass = function (languages, _callback) {
    fullFeature('ProductBannerCssClass', languages, function (result) {
        var data = []

        _.each(result.Data.Features[0].ProductBannerCssClass, function (entity) {
            data.push({
            })
        })

        _callback(data)
    })
}


exports.ProductBannerText = function (languages, _callback) {
    fullFeature('ProductBannerText', languages, function (result) {
        var data = []

        _.each(result.Data.ProductBannerText, function (entity) {
            data.push({
                id: entity['$'].id,
                order: entity['$'].order,
                value: entity.Value ? entity.Value[0]._ : undefined
            })
        })

        _callback(data)
    })
}

exports.ProductGuides = function (languages, _callback) {
    fullFeature('ProductGuides', languages, function (result) {
        var data = []

        _.each(result.Data.ProductGuides, function (entity) {
            data.push({
                id: entity['$'].id,
                order: entity['$'].order,
                value: entity.Value ? entity.Value[0]._ : undefined,
                productGuideKeys: entity.ProductGuideKeys ? entity.ProductGuideKeys[0]._ : undefined,
                productGuideTexts: entity.ProductGuideTexts ? entity.ProductGuideTexts[0]._ : undefined
            })
        })

        _callback(data)
    })
}

exports.ProductLanguage = function (languages, _callback) {
    fullFeature('ProductLanguage', languages, function (result) {
        var data = []

        _.each(result.Data.ProductLanguage, function (entity) {
            data.push({
                id: entity['$'].id,
                order: entity['$'].order,
                value: entity.Value ? entity.Value[0]._ : undefined
            })
        })

        _callback(data)
    })
}

exports.ProductLifecycle = function (languages, _callback) {
    fullFeature('ProductLifecycle', languages, function (result) {
        var data = []

        _.each(result.Data.ProductLifecycle, function (entity) {
            data.push({
                id: entity['$'].id,
                order: entity['$'].order,
                value: entity.Value ? entity.Value[0]._ : undefined
            })
        })

        _callback(data)
    })
}

exports.RetailerGroup = function (languages, _callback) {
    fullFeature('RetailerGroup', languages, function (result) {
        var data = []

        _.each(result.Data.RetailerGroup, function (entity) {
            data.push({
                id: entity['$'].id,
                order: entity['$'].order,
                value: entity.Value ? entity.Value[0]._ : undefined
            })
        })

        _callback(data)
    })
}


exports.RetailerGroupName = function (languages, _callback) {
    fullFeature('RetailerGroupName', languages, function (result) {
        var data = []

        _.each(result.Data.RetailerGroupName, function (entity) {
            data.push({
                id: entity['$'].id,
                order: entity['$'].order,
                value: entity.Value ? entity.Value[0]._ : undefined,
                distributor: entity.Distributor ? entity.Distributor[0]._ : undefined,
                retailerGroup: entity.RetailerGroup ? entity.RetailerGroup[0]._ : undefined
            })
        })

        _callback(data)
    })
}

exports.Royalties = function (languages, _callback) {
    fullFeature('Royalties', languages, function (result) {
        var data = []

        _.each(result.Data.Royalties, function (entity) {
            data.push({
                id: entity['$'].id,
                order: entity['$'].order,
                percent: entity.Percent ? entity.Percent[0]._ : undefined,
                product: entity.Product ? entity.Product[0]._ : undefined,
                royaltyReceivers: entity.RoyaltyReceivers ? entity.RoyaltyReceivers[0]._ : undefined
            })
        })

        _callback(data)
    })
}

exports.Theme = function (languages, _callback) {
    fullFeature('Theme', languages, function (result) {
        var data = []

        _.each(result.Data.Theme, function (entity) {
            data.push({
                id: entity['$'].id,
                order: entity['$'].order,
                value: entity.Value ? entity.Value[0]._ : undefined
            })
        })

        _callback(data)
    })
}

exports.TrollbeadsComCategory = function (languages, _callback) {
    fullFeature('TrollbeadsComCategory', languages, function (result) {
        var data = []

        _.each(result.Data.TrollbeadsComCategory, function (entity) {
            data.push({
                id: entity['$'].id,
                order: entity['$'].order,
                value: entity.Value ? entity.Value[0]._ : undefined
            })
        })

        _callback(data)
    })
}

exports.TrollbeadspartnerCategory = function (languages, _callback) {
    fullFeature('TrollbeadspartnerCategory', languages, function (result) {
        var data = []

        _.each(result.Data.TrollbeadspartnerCategory, function (entity) {
            data.push({
                id: entity['$'].id,
                order: entity['$'].order,
                value: entity.Value ? mapMultipleValues(entity) : undefined,
                isHiddenCategory: entity.Value ? mapMultipleValues(entity) : undefined,
                trollbeadsPartnerCategoryBrandName: entity.TrollbeadsPartnerCategoryBrandName ? entity.TrollbeadsPartnerCategoryBrandName[0]._ : undefined,
                trollbeadspartnerCategoryNote: entity.TrollbeadspartnerCategoryNote ? entity.TrollbeadspartnerCategoryNote[0]._ : undefined,
            })
        })

        _callback(data)
    })
}

exports.TrollbeadspartnerCategoryNote = function (languages, _callback) {
    fullFeature('TrollbeadspartnerCategoryNote', languages, function (result) {
        var data = []

        _.each(result.Data.TrollbeadspartnerCategoryNote, function (entity) {
            data.push({
                id: entity['$'].id,
                order: entity['$'].order,
                value: entity.Value ? entity.Value[0]._ : undefined
            })
        })

        _callback(data)
    })
}

exports.WarningText = function (languages, _callback) {
    fullFeature('WarningText', languages, function (result) {
        var data = []

        _.each(result.Data.WarningText, function (entity) {
            data.push({
                id: entity['$'].id,
                order: entity['$'].order,
                value: entity.Value ? entity.Value[0]._ : undefined
            })
        })

        _callback(data)
    })
}

exports.XJewelleryCategory = function (languages, _callback) {
    fullFeature('XJewelleryCategory', languages, function (result) {
        var data = []

        _.each(result.Data.Features, function (entity) {
            data.push({
            })
        })

        _callback(data)
    })
}

exports.YearOfCollection = function (languages, _callback) {
    fullFeature('YearOfCollection', languages, function (result) {
        var data = []

        _.each(result.Data.YearOfCollection, function (entity) {
            data.push({
                id: entity['$'].id,
                order: entity['$'].order,
                value: entity.Value ? entity.Value[0]._ : undefined
            })
        })

        _callback(data)
    })
}