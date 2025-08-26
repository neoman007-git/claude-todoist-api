// test-todoist-api.js - Run this to inspect actual API responses
// Usage: node test-todoist-api.js

require('dotenv').config();

const TODOIST_API_TOKEN = process.env.TODOIST_API_KEY;
const BASE_URL = 'https://api.todoist.com/rest/v2';

async function makeRequest(endpoint) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${TODOIST_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function inspectTaskStructure() {
  try {
    console.log('🔍 Fetching actual tasks from Todoist API...\n');
    
    const tasks = await makeRequest('/tasks');
    
    console.log(`📊 Total tasks found: ${tasks.length}\n`);
    
    // Analyze different task types
    const taskTypes = {
      withDue: tasks.filter(t => t.due !== null),
      withoutDue: tasks.filter(t => t.due === null),
      withDateTime: tasks.filter(t => t.due?.datetime),
      withTimezone: tasks.filter(t => t.due?.timezone),
      recurring: tasks.filter(t => t.due?.is_recurring === true),
    };
    
    console.log('📈 Task Analysis:');
    console.log(`  • Tasks with due dates: ${taskTypes.withDue.length}`);
    console.log(`  • Tasks without due dates: ${taskTypes.withoutDue.length}`);
    console.log(`  • Tasks with datetime: ${taskTypes.withDateTime.length}`);
    console.log(`  • Tasks with timezone: ${taskTypes.withTimezone.length}`);
    console.log(`  • Recurring tasks: ${taskTypes.recurring.length}\n`);
    
    // Show sample task structures
    console.log('🔬 Sample Task Structures:\n');
    
    if (taskTypes.withDue.length > 0) {
      console.log('📅 Task WITH due date:');
      console.log(JSON.stringify(taskTypes.withDue[0], null, 2));
      console.log('\n' + '='.repeat(50) + '\n');
    }
    
    if (taskTypes.withoutDue.length > 0) {
      console.log('📝 Task WITHOUT due date:');
      console.log(JSON.stringify(taskTypes.withoutDue[0], null, 2));
      console.log('\n' + '='.repeat(50) + '\n');
    }
    
    // Analyze due field variations
    console.log('🎯 Due Field Analysis:');
    const dueVariations = new Set();
    
    tasks.forEach((task, index) => {
      if (task.due) {
        const dueStructure = {
          hasDate: 'date' in task.due,
          hasDatetime: 'datetime' in task.due,
          hasTimezone: 'timezone' in task.due,
          hasIsRecurring: 'is_recurring' in task.due,
          hasString: 'string' in task.due,
          datetimeValue: task.due.datetime,
          timezoneValue: task.due.timezone,
        };
        dueVariations.add(JSON.stringify(dueStructure));
      }
    });
    
    console.log('Due field variations found:');
    Array.from(dueVariations).forEach((variation, index) => {
      console.log(`${index + 1}. ${variation}`);
    });
    
    // Check for unexpected fields
    console.log('\n🔍 All Task Fields Found:');
    const allFields = new Set();
    tasks.forEach(task => {
      Object.keys(task).forEach(key => allFields.add(key));
      if (task.due) {
        Object.keys(task.due).forEach(key => allFields.add(`due.${key}`));
      }
    });
    
    console.log('Fields present in API response:');
    Array.from(allFields).sort().forEach(field => {
      console.log(`  • ${field}`);
    });
    
  } catch (error) {
    console.error('❌ Error inspecting tasks:', error.message);
  }
}

async function inspectProjectStructure() {
  try {
    console.log('\n🏗️ Fetching actual projects from Todoist API...\n');
    
    const projects = await makeRequest('/projects');
    
    console.log(`📊 Total projects found: ${projects.length}\n`);
    
    if (projects.length > 0) {
      console.log('🏗️ Sample Project Structure:');
      console.log(JSON.stringify(projects[0], null, 2));
      
      // Check for unexpected fields
      console.log('\n🔍 All Project Fields Found:');
      const allFields = new Set();
      projects.forEach(project => {
        Object.keys(project).forEach(key => allFields.add(key));
      });
      
      console.log('Fields present in project API response:');
      Array.from(allFields).sort().forEach(field => {
        console.log(`  • ${field}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error inspecting projects:', error.message);
  }
}

// Main execution
async function main() {
  if (!TODOIST_API_TOKEN) {
    console.error('❌ TODOIST_API_TOKEN not found in environment variables');
    console.log('Make sure you have a .env file with TODOIST_API_TOKEN=your_token');
    process.exit(1);
  }
  
  console.log('🚀 Starting Todoist API Response Structure Analysis\n');
  console.log(`🔑 Using API token: ${TODOIST_API_TOKEN.substring(0, 8)}...\n`);
  
  await inspectTaskStructure();
  await inspectProjectStructure();
  
  console.log('\n✅ Analysis complete!');
  console.log('\nNext steps:');
  console.log('1. Review the field variations above');
  console.log('2. Update your Zod schemas to match the actual API structure');
  console.log('3. Pay special attention to nullable/optional fields');
}

main().catch(console.error);