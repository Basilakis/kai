/**
 * Gatsby configuration for the client package
 */

module.exports = {
  siteMetadata: {
    title: 'Kai - Material Recognition System',
    description: 'A comprehensive system for material recognition and catalog management',
    author: 'Kai Team',
    siteUrl: 'https://kai-materials.com',
  },
  plugins: [
    'gatsby-plugin-react-helmet',
    'gatsby-plugin-image',
    'gatsby-plugin-sharp',
    'gatsby-transformer-sharp',
    {
      resolve: 'gatsby-source-filesystem',
      options: {
        name: 'images',
        path: `${__dirname}/src/images`,
      },
    },
    {
      resolve: 'gatsby-plugin-manifest',
      options: {
        name: 'Kai - Material Recognition System',
        short_name: 'Kai',
        start_url: '/',
        background_color: '#ffffff',
        theme_color: '#5c6bc0',
        display: 'minimal-ui',
        icon: 'src/images/kai-icon.png', // This will be created later
      },
    },
    'gatsby-plugin-typescript',
    {
      resolve: 'gatsby-plugin-styled-components',
      options: {
        // Add any styled-components options here
      },
    },
    {
      resolve: 'gatsby-plugin-google-fonts',
      options: {
        fonts: [
          'roboto:400,500,700',
          'open sans:400,600,700',
        ],
        display: 'swap',
      },
    },
  ],
};