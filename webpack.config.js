const path = require("path");
const webpack = require("webpack");

module.exports = (options = {}) => ({
    entry: [
        "./src/index.js",
    ],
    // devtool: options.dev ? "cheap-module-eval-source-map" : "hidden-source-map",
    output: {
        path: path.resolve("./dist"),
        filename: "Blank.js",
        libraryTarget: "var",
        // name of the global var: "Foo"
        library: "Blank",
    },
    module: {
        loaders: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                loader: "babel",
            },
        ],
    },
    plugins: (options.dev ?
        [
        ] :
        [
            // new webpack.LoaderOptionsPlugin({
            //     minimize: true,
            //     debug: false,
            // }),
            // new webpack.optimize.UglifyJsPlugin({
            //     sourceMap: false,
            // }),
            // new webpack.DefinePlugin({
            //     "process.env": {
            //         "NODE_ENV": JSON.stringify("production"),
            //     },
            // }),
        ]
    ),
});