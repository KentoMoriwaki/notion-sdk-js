// Find the official Notion API client @ https://  github.com/makenotion/notion-sdk-js/
// npm install @notionhq/client
import { Client } from "@notionhq/client"

import * as _ from "lodash"

import { config } from "dotenv"
config()

import * as faker from "faker"
import {
  InputPropertyValueMap,
  PropertyMap,
} from "@notionhq/client/build/src/api-endpoints"
import {
  PropertyValueWithoutId,
  UserBase,
} from "@notionhq/client/build/src/api-types"

const notion = new Client({ auth: process.env["NOTION_KEY"] })

// Given the properties of a database, generate an object full of
// random data that can be used to generate new rows in our Notion database.
function makeFakePropertiesData(
  properties: PropertyMap
): InputPropertyValueMap {
  const propertyValues: InputPropertyValueMap = {}
  Object.entries(properties).forEach(([name, property]) => {
    if (property.type === "date") {
      propertyValues[name] = {
        id: property.id,
        type: "date",
        date: {
          start: faker.date.past().toISOString(),
        },
      }
    } else if (property.type === "multi_select") {
      const multiSelectOption = _.sample(property.multi_select.options)
      if (multiSelectOption) {
        propertyValues[name] = {
          type: "multi_select",
          id: property.id,
          multi_select: [multiSelectOption],
        }
      }
    } else if (property.type === "select") {
      const selectOption = _.sample(property.select.options)
      if (selectOption) {
        propertyValues[name] = {
          type: "select",
          id: property.id,
          select: selectOption,
        }
      }
    } else if (property.type === "email") {
      propertyValues[name] = {
        type: "email",
        id: property.id,
        email: faker.internet.email(),
      }
    } else if (property.type === "checkbox") {
      propertyValues[name] = {
        type: "checkbox",
        id: property.id,
        checkbox: faker.datatype.boolean(),
      }
    } else if (property.type === "url") {
      propertyValues[name] = {
        type: "url",
        id: property.id,
        url: faker.internet.url(),
      }
    } else if (property.type === "number") {
      propertyValues[name] = {
        type: "number",
        id: property.id,
        number: faker.datatype.number(),
      }
    } else if (property.type === "title") {
      propertyValues[name] = {
        type: "title",
        id: property.id,
        title: [
          {
            type: "text",
            text: { content: faker.lorem.words(3) },
          },
        ],
      }
    } else if (property.type === "rich_text") {
      propertyValues[name] = {
        type: "rich_text",
        id: property.id,
        rich_text: [
          {
            type: "text",
            text: { content: faker.name.firstName() },
          },
        ],
      }
    } else if (property.type === "phone_number") {
      propertyValues[name] = {
        type: "phone_number",
        id: property.id,
        phone_number: faker.phone.phoneNumber(),
      }
    } else {
      console.log("unimplemented property type: ", property.type)
    }
  })
  return propertyValues
}

function assertUnreachable(_x: never): never {
  throw new Error("Didn't expect to get here")
}

function userToString(userBase: UserBase) {
  return `${userBase.id}: ${userBase.name || "Unknown Name"}`
}

function extractValueToString(property: PropertyValueWithoutId): string {
  switch (property.type) {
    case "checkbox":
      return property.checkbox.toString()
    case "created_by":
      return userToString(property.created_by)
    case "created_time":
      return new Date(property.created_time).toISOString()
    case "date":
      return new Date(property.date.start).toISOString()
    case "email":
      return property.email
    case "url":
      return property.url
    case "number":
      return property.number.toString()
    case "phone_number":
      return property.phone_number
    case "select":
      return `${property.select.id} ${property.select.name}`
    case "multi_select":
      return property.multi_select
        .map(select => `${select.id} ${select.name}`)
        .join(", ")
    case "people":
      return property.people.map(person => userToString(person)).join(", ")
    case "last_edited_by":
      return userToString(property.last_edited_by)
    case "last_edited_time":
      return new Date(property.last_edited_time).toISOString()
    case "title":
      return property.title.map(t => t.plain_text).join(", ")
    case "rich_text":
      return property.rich_text.map(t => t.plain_text).join(", ")
    case "files":
      return property.files.map(file => file.name).join(", ")
    case "formula":
      if (property.formula.type === "string") {
        return property.formula.string || "???"
      } else if (property.formula.type === "number") {
        return property.formula.number?.toString() || "???"
      } else if (property.formula.type === "boolean") {
        return property.formula.boolean.toString()
      } else if (property.formula.type === "date") {
        return new Date(property.formula.date.date.start).toISOString()
      } else {
        return assertUnreachable(property.formula)
      }
    case "rollup":
      if (property.rollup.type === "number") {
        return property.rollup.number.toString()
      } else if (property.rollup.type === "date") {
        return new Date(property.rollup.date.date.start).toISOString()
      } else if (property.rollup.type === "array") {
        return JSON.stringify(property.rollup.array)
      } else {
        return assertUnreachable(property.rollup)
      }
  }
  return assertUnreachable(property)
}

async function main() {
  // Find the first database this bot has access to
  // TODO(blackmad): move to notion.search()
  const databases = await notion.databases.list({})

  if (databases.results.length === 0) {
    throw new Error("This bot doesn't have access to any databases!")
  }

  const database = databases.results[0]
  if (!database) {
    throw new Error("This bot doesn't have access to any databases!")
  }

  // Get the database properties out of our database
  const { properties } = await notion.databases.retrieve({
    database_id: database.id,
  })

  // generate a bunch of fake pages with fake data
  const startTime = new Date()
  for (let i = 0; i < 10; i++) {
    const propertiesData = makeFakePropertiesData(properties)

    await notion.pages.create({
      parent: {
        database_id: database.id,
      },
      properties: propertiesData,
    })
  }

  // and read back what we just did
  const queryResponse = await notion.databases.query({
    database_id: database.id,
  })
  let numOldRows = 0
  queryResponse.results.map(page => {
    const createdTime = new Date(page.created_time)
    if (createdTime <= startTime) {
      numOldRows++
      return
    }

    console.log(`New page: ${page.id}`)

    Object.entries(page.properties).forEach(([name, property]) => {
      console.log(
        ` - ${name} ${property.id} - ${extractValueToString(property)}`
      )
    })
  })

  console.log(`did not print ${numOldRows} old rows`)
}

main()
