<!-- Source: https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-data-operations-code-samples -->
<!-- Title: Code samples for using data operations -->

# Data operation code samples for Azure Logic Apps

[Include](https://learn.microsoft.com/en-us/azure/includes/logic-apps-sku-consumption-standard.md)

Here are the code samples for the data operation action definitions in the article, [Perform data operations](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-perform-data-operations). You can use these samples for when you want to try the examples with your own logic app's underlying workflow definition, Azure subscription, and API connections. Just copy and paste these action definitions into the code view editor for your logic app's workflow definition, and then modify the definitions for your specific workflow. 

Based on JavaScript Object Notation (JSON) standards, these action definitions appear in alphabetical order. However, in the Logic App Designer, each definition appears in the correct sequence within your workflow because each action definition's `runAfter` property specifies the run order.

<a name="compose-action-example"></a>

## Compose

To try the [**Compose** action example](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-perform-data-operations#compose-action), 
here are the action definitions you can use:

```json
"actions": {
  "Compose": {
    "type": "Compose",
    "inputs": {
      "age": "@variables('ageVar')",
      "fullName": "@{variables('lastNameVar')}, @{variables('firstNameVar')}"
    },
    "runAfter": {
      "Initialize_variable_-_ageVar": [
          "Succeeded"
      ]
    }
  },
  "Initialize_variable_-_ageVar": {
    "type": "InitializeVariable",
    "inputs": {
      "variables": [
        {
          "name": "ageVar",
          "type": "Integer",
          "value": 35
        }
      ]
    },
    "runAfter": {
      "Initialize_variable_-_lastNameVar": [
        "Succeeded"
      ]
    }
  },
  "Initialize_variable_-_firstNameVar": {
    "type": "InitializeVariable",
    "inputs": {
      "variables": [
        {
          "name": "firstNameVar",
          "type": "String",
          "value": "Sophia "
        }
      ]
    },
    "runAfter": {}
  },
  "Initialize_variable_-_lastNameVar": {
    "type": "InitializeVariable",
    "inputs": {
      "variables": [
        {
          "name": "lastNameVar",
          "type": "String",
          "value": "Owens"
        }
      ]
    },
    "runAfter": {
      "Initialize_variable_-_firstNameVar": [
        "Succeeded"
      ]
    }
  }
},
```

<a name="create-csv-table-action-example"></a>

## Create CSV table

To try the [**Create CSV table** action example](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-perform-data-operations#create-csv-table-action), here are the action definitions you can use:

```json
"actions": {
   "Create_CSV_table": {
      "type": "Table",     
      "inputs": {
         "format": "CSV",
         "from": "@variables('myJSONArray')"
      },
      "runAfter": {
         "Initialize_variable_-_JSON_array": [
            "Succeeded"
         ]
      }
   },
   "Initialize_variable_-_JSON_array": {
      "type": "InitializeVariable",
      "inputs": {
         "variables": [ 
            {
               "name": "myJSONArray",
               "type": "Array",
                  "value": [
                     {
                        "Description": "Apples",
                        "Product_ID": 1
                     },
                     {
                        "Description": "Oranges",
                        "Product_ID": 2
                     }
                  ]
            }
         ]
      },
      "runAfter": {}
   }
},
```

<a name="create-html-table-action-example"></a>

## Create HTML table

To try the [**Create HTML table** action example](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-perform-data-operations#create-html-table-action), 
here are the action definitions you can use:

```json
"actions": {
   "Create_HTML_table": {
      "type": "Table",     
      "inputs": {
         "format": "HTML",
         "from": "@variables('myJSONArray')"
      },
      "runAfter": {
         "Initialize_variable_-_JSON_array": [
            "Succeeded"
         ]
      }
   },
   "Initialize_variable_-_JSON_array": {
      "type": "InitializeVariable",
      "inputs": {
         "variables": [ 
            {
               "name": "myJSONArray",
               "type": "Array",
                  "value": [
                     {
                        "Description": "Apples",
                        "Product_ID": 1
                     },
                     {
                        "Description": "Oranges",
                        "Product_ID": 2
                     }
                  ]
            }
         ]
      },
      "runAfter": {}
   }
},
```

<a name="filter-array-action-example"></a>

## Filter array

To try the [**Filter array** action example](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-perform-data-operations#filter-array-action), here are the action definitions you can use:

```json
"actions": {
   "Filter_array": {
      "type": "Query",
      "inputs": {
         "from": "@variables('myIntegerArray')",
         "where": "@greater(item(), 1)"
      },
      "runAfter": {
         "Initialize_variable_-_integer_array": [
            "Succeeded"
         ]
      }
   },
   "Initialize_variable_-_integer_array": {
      "type": "InitializeVariable",
      "inputs": {
         "variables": [ 
            {
               "name": "myIntegerArray",
               "type": "Array",
               "value": [
                  1,
                  2,
                  3,
                  4
               ]
            }
         ]
      },
      "runAfter": {}
   }
},
```

<a name="join-action-example"></a>

## Join

To try the [**Join** action example](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-perform-data-operations#join-action), here are the action definitions you can use:

```json
"actions": {
   "Initialize_variable_-_integer_array": {
      "type": "InitializeVariable",
      "inputs": {
         "variables": [ 
            {
               "name": "myIntegerArray",
               "type": "Array",
               "value": [
                  1,
                  2,
                  3,
                  4
               ]
            }
         ]
      },
      "runAfter": {}
   },
   "Join": {
      "type": "Join",
      "inputs": {
         "from": "@variables('myIntegerArray')",
         "joinWith": ":"
      },
      "runAfter": {
         "Initialize_variable_-_integer_array": [
             "Succeeded"
         ]
      }
   }
},
```

<a name="parse-json-action-example"></a>

## Parse JSON

To try the [**Parse JSON** action example](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-perform-data-operations#parse-json-action), here are the action definitions you can use:

```json
"actions": {
   "Initialize_variable_-_JSON_object": {
      "type": "InitializeVariable",
      "inputs": {
         "variables": [
            {
               "name": "myJSONObject",
               "type": "Object",
               "value": {
                  "Member": {
                     "Email": "Sophia.Owens@fabrikam.com",
                     "FirstName": "Sophia",
                     "LastName": "Owens"
                  }
               }
            }
         ]
      },
      "runAfter": {}
   },
   "Parse_JSON": {
      "type": "ParseJson",
      "inputs": {
         "content": "@variables('myJSONObject')",
         "schema": {
            "type": "object",
            "properties": {
               "Member": {
                  "type": "object",
                  "properties": {
                     "Email": {
                        "type": "string"
                     },
                     "FirstName": {
                        "type": "string"
                     },
                     "LastName": {
                        "type": "string"
                     }
                  }
               }
            }
         }
      },
      "runAfter": {
         "Initialize_variable_-_JSON_object": [
            "Succeeded"
         ]
      }
   }
},
```

<a name="select-action-example"></a>

## Select

To try the [**Select** action example](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-perform-data-operations#select-action), the following action definitions create a JSON object array from an integer array:

```json
"actions": {
   "Initialize_variable_-_integer_array": {
      "type": "InitializeVariable",
      "inputs": {
         "variables": [ 
            {
               "name": "myIntegerArray",
               "type": "Array",
               "value": [
                  1,
                  2,
                  3,
                  4
               ]
            }
         ]
      },
      "runAfter": {}
   },
   "Select": {
      "type": "Select",
      "inputs": {
         "from": "@variables('myIntegerArray')",
         "select": {
            "Product_ID": "@item()"
         }
      },
      "runAfter": {
         "Initialize_variable_-_integer_array": [
           "Succeeded"
         ]
      }
   }
},
```

The following example shows action definitions that create a string array from a JSON object array, but for this task, next to the **Map** box, switch to text mode (**T** icon) in the designer, or use the code view editor instead:

```json
"actions": {
   "Initialize_variable_-_object_array": {
      "type": "InitializeVariable",
      "inputs": {
         "variables": [ 
            {
               "name": "myObjectArray",
               "type": "Array",
               "value": [
                  {"Val":"1", "Txt":"One"},
                  {"Val":"2", "Txt":"Two"},
                  {"Val":"4", "Txt":"Four"},
                  {"Val":"10", "Txt":"Ten"}
               ]
            }
         ]
      },
      "runAfter": {}
   },
   "Select": {
      "type": "Select",
      "inputs": {
         "from": "@body('myObjectArray')?['value']",
         "select": "@{item()?['Txt']}"
      },
      "runAfter": {
         "Initialize_variable_-_object_array": [
           "Succeeded"
         ]
      }
   }
},
```

## Next steps

* [Perform data operations](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-perform-data-operations)
