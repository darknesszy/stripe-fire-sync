# Stripe FireSync
Synchronise data between Firebase dashboard and Stripe dashboard. 

** Currently only support manual run. Future updates will add change detection, allowing it to be hosted on a server.

# Environment Variables
>STRIPE_SECRET_KEY

API key obtained from Stripe dashboard.

>GOOGLE_APPLICATION_CREDENTIALS

File path to the API key json file downloaded from Firebase project settings.

>PROJECT_ID

Project ID found in Firebase project settings.

# Quick Start

Run installation of node modules.

`npm install`

Build project with Typescript. Output is in ./dist folder.

`npm build`

Create a file named .env in the root directory and fill in the environment variables. Run the tool.

`node ./dist/index.js --product -p price -n name`

# Usage
`node ./dist/index.js [COMMAND] [ARGS...]`

The `--product` command create/updates price listing on Stripe, which creates the product along the way. Supplying an option to the command will be treated as the key to a field that should be appended to the name of the product unless specified otherwise.

`shopify` is currently supported as an explicit option for the `--product` command. In this case, no additional keys are accepted.

`--Clear` command would purge the specified collection of all stripe id.

# Arguments
<table>
    <thead>
        <tr>
            <th>Name, shorthand</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>
                <code>--sync, -s</code>
            </td>
            <td>
                Specifies the Collection name to be synced to Stripe. Required.
            </td>
        </tr>
        <tr>
            <td>
                <code>--price, -p</code>
            </td>
            <td>
                Specifies the desired field to be used for unit prices on Stripe. Not applicable with Shopify.
            </td>
        </tr>
        <tr>
            <td>
                <code>--name, -n</code>
            </td>
            <td>
                Specifies the desired field to be used for product name on Stripe. Not applicable with Shopify.
            </td>
        </tr>
    </tbody>
</table>