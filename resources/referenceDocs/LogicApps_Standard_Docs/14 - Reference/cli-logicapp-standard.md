<!-- Source: https://learn.microsoft.com/en-us/cli/azure/logicapp -->

Table of contents 
			
			
				
				Exit editor mode
			
		
	
			
				
					
		
			
				
		
			
				
					
				
			
			
		

		
	 
		
			
		
			
				
			
		
		
			
				
			
			Ask Learn
		
		
			
				
			
			Ask Learn
		
	 
		
			
				
			
			Focus mode
		
	 

			
				
					
						
					
				
				
					
		
			
				
			
			Table of contents
		
	 
		
			
				
			
			Read in English
		
	 
		
			
				
			
			Add
		
	
					
		
			
				
			
			Add to plan
		
	  
					
		
		#### Share via
		
					
						
							
						
						Facebook
					

					
						
							
						
						x.com
					

					
						
							
						
						LinkedIn
					
					
						
							
						
						Email
					
			  
	 
		
		
				
					
						
						
						
					
					Copy Markdown
				
		   
				
					
						
					
					Print
				
		  
	
				
			
		
	
			
		
	  
		
		
			
			
				
					

						
							
						
						Note
					

					

						Access to this page requires authorization. You can try [signing in](#) or changing directories.
					

					

						Access to this page requires authorization. You can try changing directories.
					

				
			
		
	
					
					 
		
			
				
					
				
				
					
						Summarize this article for me
					
				
			
			
			
		
	 
					# az logicapp

	
		
			
			
			
			
			
		
	

	
		
Manage logic apps.

		
	

## Commands

	
		
			Name
			Description
			Type
			Status
		
	
	
			
	
		[az logicapp config](logicapp/config?view=azure-cli-latest)
	
	
			
Configure a logic app.

	
	
		Core
	
	
		GA
	

			
	
		[az logicapp config appsettings](logicapp/config/appsettings?view=azure-cli-latest)
	
	
			
Configure logic app settings.

	
	
		Core
	
	
		GA
	

			
	
		[az logicapp config appsettings delete](logicapp/config/appsettings?view=azure-cli-latest#az-logicapp-config-appsettings-delete)
	
	
			
Delete a logic app's settings.

	
	
		Core
	
	
		GA
	

			
	
		[az logicapp config appsettings list](logicapp/config/appsettings?view=azure-cli-latest#az-logicapp-config-appsettings-list)
	
	
			
Show settings for a logic app.

	
	
		Core
	
	
		GA
	

			
	
		[az logicapp config appsettings set](logicapp/config/appsettings?view=azure-cli-latest#az-logicapp-config-appsettings-set)
	
	
			
Update a logic app's settings.

	
	
		Core
	
	
		GA
	

			
	
		[az logicapp create](logicapp?view=azure-cli-latest#az-logicapp-create)
	
	
			
Create a logic app.

	
	
		Core
	
	
		GA
	

			
	
		[az logicapp delete](logicapp?view=azure-cli-latest#az-logicapp-delete)
	
	
			
Delete a logic app.

	
	
		Core
	
	
		GA
	

			
	
		[az logicapp deployment](logicapp/deployment?view=azure-cli-latest)
	
	
			
Manage logic app deployments.

	
	
		Core
	
	
		GA
	

			
	
		[az logicapp deployment source](logicapp/deployment/source?view=azure-cli-latest)
	
	
			
Manage logicapp app deployment via source control.

	
	
		Core
	
	
		GA
	

			
	
		[az logicapp deployment source config-zip](logicapp/deployment/source?view=azure-cli-latest#az-logicapp-deployment-source-config-zip)
	
	
			
Perform deployment using the kudu zip push deployment for a logic app.

	
	
		Core
	
	
		GA
	

			
	
		[az logicapp list](logicapp?view=azure-cli-latest#az-logicapp-list)
	
	
			
List logic apps.

	
	
		Core
	
	
		GA
	

			
	
		[az logicapp restart](logicapp?view=azure-cli-latest#az-logicapp-restart)
	
	
			
Restart a logic app.

	
	
		Core
	
	
		GA
	

			
	
		[az logicapp scale](logicapp?view=azure-cli-latest#az-logicapp-scale)
	
	
			
Scale a logic app.

	
	
		Core
	
	
		GA
	

			
	
		[az logicapp show](logicapp?view=azure-cli-latest#az-logicapp-show)
	
	
			
Get the details of a logic app.

	
	
		Core
	
	
		GA
	

			
	
		[az logicapp start](logicapp?view=azure-cli-latest#az-logicapp-start)
	
	
			
Start a logic app.

	
	
		Core
	
	
		GA
	

			
	
		[az logicapp stop](logicapp?view=azure-cli-latest#az-logicapp-stop)
	
	
			
Stop a logic app.

	
	
		Core
	
	
		GA
	

			
	
		[az logicapp update](logicapp?view=azure-cli-latest#az-logicapp-update)
	
	
			
Update a logic app.

	
	
		Core
	
	
		GA
	

	

	
		az logicapp create
	

	
		
		
		
		
		
	

	
		
Create a logic app.

	

	
		
The logic app's name must be able to produce a unique FQDN as AppName.azurewebsites.net.

	

	
az logicapp create --name
                   --resource-group
                   --storage-account
                   [--app-insights]
                   [--app-insights-key]
                   [--deployment-container-image-name]
                   [--deployment-local-git]
                   [--deployment-source-branch]
                   [--deployment-source-url]
                   [--disable-app-insights {false, true}]
                   [--docker-registry-server-password]
                   [--docker-registry-server-user]
                   [--functions-version {4}]
                   [--https-only {false, true}]
                   [--plan]
                   [--runtime-version {~14, ~16, ~18}]
                   [--tags]

	### Examples
			
Create a basic logic app.

			
`az logicapp create -g myRG --subscription mySubscription -p MyPlan -n myLogicApp -s myStorageAccount`

	### Required Parameters

	--name -n
	
		
		
		
		
		
	

	
Name of the new logic app.

	

	--resource-group -g
	
		
		
		
		
		
	

	
Name of resource group. You can configure the default group using `az configure --defaults group=<name>`.

	

	--storage-account -s
	
		
		
		
		
		
	

	
Provide a string value of a Storage Account in the provided Resource Group. Or Resource ID of a Storage Account in a different Resource Group.

	

	### Optional Parameters
	
The following parameters are optional, but depending on the context, one or more might become required for the command to execute successfully.

	--app-insights
	
		
		
		
		
		
	

	
Name of the existing App Insights project to be added to the logic app. Must be in the same resource group.

	

	--app-insights-key
	
		
		
		
		
		
	

	
Instrumentation key of App Insights to be added.

	

	--deployment-container-image-name -i
	
		
		
		
		
		
	

	
Container image name from container registry, e.g. publisher/image-name:tag.

	

	--deployment-local-git -l
	
		
		
		
		
		
	

	
Enable local git.

	

	--deployment-source-branch -b
	
		
		
		
		
		
	

	
The branch to deploy.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							master
						
					
			
		

	--deployment-source-url -u
	
		
		
		
		
		
	

	
Git repository URL to link with manual integration.

	

	--disable-app-insights
	
		
		
		
		
		
	

	
Disable creating application insights resource during logicapp create. No logs will be available.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Accepted values:
						
						
							false, true
						
					
			
		

	--docker-registry-server-password -w
	
		
		
		
		
		
	

	
The container registry server password. Required for private registries.

	

	--docker-registry-server-user -d
	
		
		
		
		
		
	

	
The container registry server username.

	

	--functions-version -v
	
		
		
		
		
		
	

	
The functions version for logic app.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							4
						
					
					
						
							Accepted values:
						
						
							4
						
					
			
		

	--https-only
	
		
		
		
		
		
	

	
Redirect all traffic made to an app using HTTP to HTTPS.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							False
						
					
					
						
							Accepted values:
						
						
							false, true
						
					
			
		

	--plan -p
	
		
		
		
		
		
	

	
Name or resource id of the logicapp app service plan. Use 'appservice plan create' to get one. If using an App Service plan from a different resource group, the full resource id must be used and not the plan name.

	

	--runtime-version
	
		
		
		
		
		
	

	
The runtime version for logic app.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Accepted values:
						
						
							~14, ~16, ~18
						
					
			
		

	--tags
	
		
		
		
		
		
	

	
Space-separated tags: key[=value] [key[=value] ...]. Use "" to clear existing tags.

	

	
		
			Global Parameters
			
				
			
		

	--debug
	
		
		
		
		
		
	

	
Increase logging verbosity to show all debug logs.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							False
						
					
			
		

	--help -h
	
		
		
		
		
		
	

	
Show this help message and exit.

	

	--only-show-errors
	
		
		
		
		
		
	

	
Only show errors, suppressing warnings.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							False
						
					
			
		

	--output -o
	
		
		
		
		
		
	

	
Output format.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							json
						
					
					
						
							Accepted values:
						
						
							json, jsonc, none, table, tsv, yaml, yamlc
						
					
			
		

	--query
	
		
		
		
		
		
	

	
JMESPath query string. See [http://jmespath.org/](http://jmespath.org/) for more information and examples.

	

	--subscription
	
		
		
		
		
		
	

	
Name or ID of subscription. You can configure the default subscription using `az account set -s NAME_OR_ID`.

	

	--verbose
	
		
		
		
		
		
	

	
Increase logging verbosity. Use --debug for full debug logs.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							False
						
					
			
		

	

	
		az logicapp delete
	

	
		
		
		
		
		
	

	
		
Delete a logic app.

	

	
az logicapp delete --name
                   --resource-group
                   [--slot]
                   [--yes]

	### Examples
			
Delete a logic app.

			
`az logicapp delete --name myLogicApp --resource-group myRG --subscription mySubscription`

	### Required Parameters

	--name -n
	
		
		
		
		
		
	

	
Name of the logic app.

	

	--resource-group -g
	
		
		
		
		
		
	

	
Name of resource group. You can configure the default group using `az configure --defaults group=<name>`.

	

	### Optional Parameters
	
The following parameters are optional, but depending on the context, one or more might become required for the command to execute successfully.

	--slot -s
	
		
		
		
		
		
	

	
The name of the slot. Default to the productions slot if not specified.

	

	--yes -y
	
		
		
		
		
		
	

	
Do not prompt for confirmation.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							False
						
					
			
		

	
		
			Global Parameters
			
				
			
		

	--debug
	
		
		
		
		
		
	

	
Increase logging verbosity to show all debug logs.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							False
						
					
			
		

	--help -h
	
		
		
		
		
		
	

	
Show this help message and exit.

	

	--only-show-errors
	
		
		
		
		
		
	

	
Only show errors, suppressing warnings.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							False
						
					
			
		

	--output -o
	
		
		
		
		
		
	

	
Output format.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							json
						
					
					
						
							Accepted values:
						
						
							json, jsonc, none, table, tsv, yaml, yamlc
						
					
			
		

	--query
	
		
		
		
		
		
	

	
JMESPath query string. See [http://jmespath.org/](http://jmespath.org/) for more information and examples.

	

	--subscription
	
		
		
		
		
		
	

	
Name or ID of subscription. You can configure the default subscription using `az account set -s NAME_OR_ID`.

	

	--verbose
	
		
		
		
		
		
	

	
Increase logging verbosity. Use --debug for full debug logs.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							False
						
					
			
		

	

	
		az logicapp list
	

	
		
		
		
		
		
	

	
		
List logic apps.

	

	
`az logicapp list [--resource-group]`

	### Examples
			
List default host name and state for all logic apps.

			
`az logicapp list --query "[].hostName: defaultHostName, state: state"`
			
List all running logic apps.

			
`az logicapp list --query "[?state=='Running']"`

	### Optional Parameters
	
The following parameters are optional, but depending on the context, one or more might become required for the command to execute successfully.

	--resource-group -g
	
		
		
		
		
		
	

	
Name of resource group. You can configure the default group using `az configure --defaults group=<name>`.

	

	
		
			Global Parameters
			
				
			
		

	--debug
	
		
		
		
		
		
	

	
Increase logging verbosity to show all debug logs.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							False
						
					
			
		

	--help -h
	
		
		
		
		
		
	

	
Show this help message and exit.

	

	--only-show-errors
	
		
		
		
		
		
	

	
Only show errors, suppressing warnings.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							False
						
					
			
		

	--output -o
	
		
		
		
		
		
	

	
Output format.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							json
						
					
					
						
							Accepted values:
						
						
							json, jsonc, none, table, tsv, yaml, yamlc
						
					
			
		

	--query
	
		
		
		
		
		
	

	
JMESPath query string. See [http://jmespath.org/](http://jmespath.org/) for more information and examples.

	

	--subscription
	
		
		
		
		
		
	

	
Name or ID of subscription. You can configure the default subscription using `az account set -s NAME_OR_ID`.

	

	--verbose
	
		
		
		
		
		
	

	
Increase logging verbosity. Use --debug for full debug logs.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							False
						
					
			
		

	

	
		az logicapp restart
	

	
		
		
		
		
		
	

	
		
Restart a logic app.

	

	
az logicapp restart --name
                    --resource-group
                    [--slot]

	### Examples
			
Restart a logic app.

			
`az logicapp restart --name myLogicApp --resource-group myRG`

	### Required Parameters

	--name -n
	
		
		
		
		
		
	

	
Name of the logic app.

	

	--resource-group -g
	
		
		
		
		
		
	

	
Name of resource group. You can configure the default group using `az configure --defaults group=<name>`.

	

	### Optional Parameters
	
The following parameters are optional, but depending on the context, one or more might become required for the command to execute successfully.

	--slot -s
	
		
		
		
		
		
	

	
The name of the slot. Default to the productions slot if not specified.

	

	
		
			Global Parameters
			
				
			
		

	--debug
	
		
		
		
		
		
	

	
Increase logging verbosity to show all debug logs.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							False
						
					
			
		

	--help -h
	
		
		
		
		
		
	

	
Show this help message and exit.

	

	--only-show-errors
	
		
		
		
		
		
	

	
Only show errors, suppressing warnings.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							False
						
					
			
		

	--output -o
	
		
		
		
		
		
	

	
Output format.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							json
						
					
					
						
							Accepted values:
						
						
							json, jsonc, none, table, tsv, yaml, yamlc
						
					
			
		

	--query
	
		
		
		
		
		
	

	
JMESPath query string. See [http://jmespath.org/](http://jmespath.org/) for more information and examples.

	

	--subscription
	
		
		
		
		
		
	

	
Name or ID of subscription. You can configure the default subscription using `az account set -s NAME_OR_ID`.

	

	--verbose
	
		
		
		
		
		
	

	
Increase logging verbosity. Use --debug for full debug logs.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							False
						
					
			
		

	

	
		az logicapp scale
	

	
		
		
		
		
		
	

	
		
Scale a logic app.

	

	
az logicapp scale --name
                  --resource-group
                  [--max-instances]
                  [--min-instances]
                  [--slot]

	### Examples
			
Scale a logic app.

			
`az logicapp scale --name myLogicApp --resource-group myRG --subscription mySubscription --min-instances 2 --max-instances 4`

	### Required Parameters

	--name -n
	
		
		
		
		
		
	

	
Name of the logic app.

	

	--resource-group -g
	
		
		
		
		
		
	

	
Name of resource group. You can configure the default group using `az configure --defaults group=<name>`.

	

	### Optional Parameters
	
The following parameters are optional, but depending on the context, one or more might become required for the command to execute successfully.

	--max-instances
	
		
		
		
		
		
	

	
The maximum number of instances this logic app can scale out to under load.

	

	--min-instances
	
		
		
		
		
		
	

	
The number of instances that are always ready and warm for this logic app.

	

	--slot -s
	
		
		
		
		
		
	

	
The name of the slot. Default to the productions slot if not specified.

	

	
		
			Global Parameters
			
				
			
		

	--debug
	
		
		
		
		
		
	

	
Increase logging verbosity to show all debug logs.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							False
						
					
			
		

	--help -h
	
		
		
		
		
		
	

	
Show this help message and exit.

	

	--only-show-errors
	
		
		
		
		
		
	

	
Only show errors, suppressing warnings.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							False
						
					
			
		

	--output -o
	
		
		
		
		
		
	

	
Output format.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							json
						
					
					
						
							Accepted values:
						
						
							json, jsonc, none, table, tsv, yaml, yamlc
						
					
			
		

	--query
	
		
		
		
		
		
	

	
JMESPath query string. See [http://jmespath.org/](http://jmespath.org/) for more information and examples.

	

	--subscription
	
		
		
		
		
		
	

	
Name or ID of subscription. You can configure the default subscription using `az account set -s NAME_OR_ID`.

	

	--verbose
	
		
		
		
		
		
	

	
Increase logging verbosity. Use --debug for full debug logs.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							False
						
					
			
		

	

	
		az logicapp show
	

	
		
		
		
		
		
	

	
		
Get the details of a logic app.

	

	
az logicapp show --name
                 --resource-group

	### Examples
			
Get the details of a logic app.

			
`az logicapp show --name myLogicApp --resource-group myRG --subscription mySubscription`

	### Required Parameters

	--name -n
	
		
		
		
		
		
	

	
Name of the logic app.

	

	--resource-group -g
	
		
		
		
		
		
	

	
Name of resource group. You can configure the default group using `az configure --defaults group=<name>`.

	

	
		
			Global Parameters
			
				
			
		

	--debug
	
		
		
		
		
		
	

	
Increase logging verbosity to show all debug logs.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							False
						
					
			
		

	--help -h
	
		
		
		
		
		
	

	
Show this help message and exit.

	

	--only-show-errors
	
		
		
		
		
		
	

	
Only show errors, suppressing warnings.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							False
						
					
			
		

	--output -o
	
		
		
		
		
		
	

	
Output format.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							json
						
					
					
						
							Accepted values:
						
						
							json, jsonc, none, table, tsv, yaml, yamlc
						
					
			
		

	--query
	
		
		
		
		
		
	

	
JMESPath query string. See [http://jmespath.org/](http://jmespath.org/) for more information and examples.

	

	--subscription
	
		
		
		
		
		
	

	
Name or ID of subscription. You can configure the default subscription using `az account set -s NAME_OR_ID`.

	

	--verbose
	
		
		
		
		
		
	

	
Increase logging verbosity. Use --debug for full debug logs.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							False
						
					
			
		

	

	
		az logicapp start
	

	
		
		
		
		
		
	

	
		
Start a logic app.

	

	
az logicapp start --name
                  --resource-group
                  [--slot]

	### Examples
			
Start a logic app

			
`az logicapp start --name myLogicApp --resource-group myRG`

	### Required Parameters

	--name -n
	
		
		
		
		
		
	

	
Name of the logic app.

	

	--resource-group -g
	
		
		
		
		
		
	

	
Name of resource group. You can configure the default group using `az configure --defaults group=<name>`.

	

	### Optional Parameters
	
The following parameters are optional, but depending on the context, one or more might become required for the command to execute successfully.

	--slot -s
	
		
		
		
		
		
	

	
The name of the slot. Default to the productions slot if not specified.

	

	
		
			Global Parameters
			
				
			
		

	--debug
	
		
		
		
		
		
	

	
Increase logging verbosity to show all debug logs.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							False
						
					
			
		

	--help -h
	
		
		
		
		
		
	

	
Show this help message and exit.

	

	--only-show-errors
	
		
		
		
		
		
	

	
Only show errors, suppressing warnings.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							False
						
					
			
		

	--output -o
	
		
		
		
		
		
	

	
Output format.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							json
						
					
					
						
							Accepted values:
						
						
							json, jsonc, none, table, tsv, yaml, yamlc
						
					
			
		

	--query
	
		
		
		
		
		
	

	
JMESPath query string. See [http://jmespath.org/](http://jmespath.org/) for more information and examples.

	

	--subscription
	
		
		
		
		
		
	

	
Name or ID of subscription. You can configure the default subscription using `az account set -s NAME_OR_ID`.

	

	--verbose
	
		
		
		
		
		
	

	
Increase logging verbosity. Use --debug for full debug logs.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							False
						
					
			
		

	

	
		az logicapp stop
	

	
		
		
		
		
		
	

	
		
Stop a logic app.

	

	
az logicapp stop --name
                 --resource-group
                 [--slot]

	### Examples
			
Stop a logic app.

			
`az logicapp stop --name myLogicApp --resource-group myRG`

	### Required Parameters

	--name -n
	
		
		
		
		
		
	

	
Name of the logic app.

	

	--resource-group -g
	
		
		
		
		
		
	

	
Name of resource group. You can configure the default group using `az configure --defaults group=<name>`.

	

	### Optional Parameters
	
The following parameters are optional, but depending on the context, one or more might become required for the command to execute successfully.

	--slot -s
	
		
		
		
		
		
	

	
The name of the slot. Default to the productions slot if not specified.

	

	
		
			Global Parameters
			
				
			
		

	--debug
	
		
		
		
		
		
	

	
Increase logging verbosity to show all debug logs.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							False
						
					
			
		

	--help -h
	
		
		
		
		
		
	

	
Show this help message and exit.

	

	--only-show-errors
	
		
		
		
		
		
	

	
Only show errors, suppressing warnings.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							False
						
					
			
		

	--output -o
	
		
		
		
		
		
	

	
Output format.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							json
						
					
					
						
							Accepted values:
						
						
							json, jsonc, none, table, tsv, yaml, yamlc
						
					
			
		

	--query
	
		
		
		
		
		
	

	
JMESPath query string. See [http://jmespath.org/](http://jmespath.org/) for more information and examples.

	

	--subscription
	
		
		
		
		
		
	

	
Name or ID of subscription. You can configure the default subscription using `az account set -s NAME_OR_ID`.

	

	--verbose
	
		
		
		
		
		
	

	
Increase logging verbosity. Use --debug for full debug logs.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							False
						
					
			
		

	

	
		az logicapp update
	

	
		
		
		
		
		
	

	
		
Update a logic app.

	

	
az logicapp update --name
                   --resource-group
                   [--add]
                   [--force-string]
                   [--plan]
                   [--remove]
                   [--set]
                   [--slot]

	### Examples
			
Update a logic app. (autogenerated)

			
`az logicapp update --name myLogicApp --resource-group myRG`

	### Required Parameters

	--name -n
	
		
		
		
		
		
	

	
Name of the logic app.

	

	--resource-group -g
	
		
		
		
		
		
	

	
Name of resource group. You can configure the default group using `az configure --defaults group=<name>`.

	

	### Optional Parameters
	
The following parameters are optional, but depending on the context, one or more might become required for the command to execute successfully.

	--add
	
		
		
		
		
		
	

	
Add an object to a list of objects by specifying a path and key value pairs.  Example: `--add property.listProperty <key=value, string or JSON string>`.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Parameter group:
						
						
							Generic Update Arguments
						
					
					
						
							Default value:
						
						
							[]
						
					
			
		

	--force-string
	
		
		
		
		
		
	

	
When using 'set' or 'add', preserve string literals instead of attempting to convert to JSON.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Parameter group:
						
						
							Generic Update Arguments
						
					
					
						
							Default value:
						
						
							False
						
					
			
		

	--plan
	
		
		
		
		
		
	

	
The name or resource id of the plan to update the logicapp with.

	

	--remove
	
		
		
		
		
		
	

	
Remove a property or an element from a list.  Example: `--remove property.list <indexToRemove>` OR `--remove propertyToRemove`.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Parameter group:
						
						
							Generic Update Arguments
						
					
					
						
							Default value:
						
						
							[]
						
					
			
		

	--set
	
		
		
		
		
		
	

	
Update an object by specifying a property path and value to set.  Example: `--set property1.property2=<value>`.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Parameter group:
						
						
							Generic Update Arguments
						
					
					
						
							Default value:
						
						
							[]
						
					
			
		

	--slot -s
	
		
		
		
		
		
	

	
The name of the slot. Default to the productions slot if not specified.

	

	
		
			Global Parameters
			
				
			
		

	--debug
	
		
		
		
		
		
	

	
Increase logging verbosity to show all debug logs.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							False
						
					
			
		

	--help -h
	
		
		
		
		
		
	

	
Show this help message and exit.

	

	--only-show-errors
	
		
		
		
		
		
	

	
Only show errors, suppressing warnings.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							False
						
					
			
		

	--output -o
	
		
		
		
		
		
	

	
Output format.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							json
						
					
					
						
							Accepted values:
						
						
							json, jsonc, none, table, tsv, yaml, yamlc
						
					
			
		

	--query
	
		
		
		
		
		
	

	
JMESPath query string. See [http://jmespath.org/](http://jmespath.org/) for more information and examples.

	

	--subscription
	
		
		
		
		
		
	

	
Name or ID of subscription. You can configure the default subscription using `az account set -s NAME_OR_ID`.

	

	--verbose
	
		
		
		
		
		
	

	
Increase logging verbosity. Use --debug for full debug logs.

	

		
			
				
					Property
					Value
				
			
			
					
						
							Default value:
						
						
							False
						
					
			
		

	

					
		
	 
		
		
	
					
			
		
		
			
				
					
						
							
								
							
							
								Collaborate with us on GitHub
							
						
						
							The source for this content can be found on GitHub, where you can also create and review issues and pull requests. For more information, see [our contributor guide](https://learn.microsoft.com/contribute/content/how-to-write-overview).
						
					
				
				
					
						
					
						
							![](https://learn.microsoft.com/media/logos/logo_azure.svg)
							![](https://learn.microsoft.com/media/logos/logo_azure.svg)
						
					
			  

						
							

								Azure CLI
							

							
								

								
									
										
											
										
										Open a documentation issue
									
									
										
											
										
										Provide product feedback
									
								
							
						
					
				
			
		
		
	
			
		
		
			
			## Feedback
			
				

					Was this page helpful?
				

				
					
						
							
						
						Yes
					
					
						
							
						
						No
					
					
						
							
								
							
							No
						
						
							

								Need help with this topic?
							

							

								Want to try using Ask Learn to clarify or guide you through this topic?
							

							
		
			
		
			
				
			
		
		
			
				
			
			Ask Learn
		
		
			
				
			
			Ask Learn
		
	
			
				
					
				
				 Suggest a fix?