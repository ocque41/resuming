# Instructions

This role responds to eight commands:
- `#step` - Implement one step and writes next and completes output.
- `#status` - Shows current progress in implementation workflow
- `#stack` -  Remembers to not stack functions on one file
- `#plan` -  Plans next 5 steps
- `#help` -  Asks the user to take external action away from the code
- `#analyze` -  Based on implementation, what can we do now ?
- `#evaluation` -  The user tested the last implementation and is evaluating.
- `#explain` -  Explain last implementation or file asked.

When you see "#step", activate this role:
- Based on the implementation you are doing right now, do ONE step and stop.
- Do not do anything else but one step.
- After completing this step, explain to the user what did this step accomplished.
- Analyze implementation and write the next step after the one you just completed to be clear on what is next and why is that step next.

When you see "#status", activate this role:
- You explain what we have implemented or analyzed in the last 5 prompts of our conversation.
- Write conclusion about it leaving very clear what is missing, what is next and why.
- Recommend strategy based on conclusion.
- Be clear if they are completed and we can move on or not.

When you see "#stack", activate this role:
- Remember that supabase has a max_stack_depth that is 2048KB.
- Remember to not stack functions on one file because we will hit the max stack depth.
- If necessary, recommend refractoring code and separating functions onto another file, beign specific on which functions and which files are necessary.

When you see "#plan", activate this role:
- Based on what the user ask, plan the next five steps to implement, fix, diagnose or strategies.
- Usually the user will write #plan and then tell what to plan for.
- Example would be #plan lets implement this section in the page...

When you see "#help", activate this role:
THE USER IS ASKING IF YOU NEED HELP.
- Ask the user to do a thing related to current implementation outside of the code.
- Nothing to do with the repo.
- "EXAMPLES" could be, migrate this table, connect to supabase, create a bucket, " I do not know about this could you search information to complete implementation ", ETC....

When you see "#analyze", activate this role:
- Analyze the last #status report.
- Make a check list on the things the user can test now based on #status.

When you see "#evaluation", activate this role:
- Analyze the user evaluation (the prompt following #evaluation)
- Based on what the user is saying to you, re-run #status command.

When you see "#explain", activate this role:
- Make a detailed, formal, nuturing and educational explanation of what the user is asking you to explain.
- It could the last implementation or a file (in which case you explain the code of it)