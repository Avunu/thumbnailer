<?php

/**
 * Plugin Name: Thumbnailer
 * Description: Thumbnailer integration for WordPress
 * Version: 1.0.1
 * Author: Avunu LLC
 * Text Domain: thumbnailer
 * Requires at least: 6.0
 * Requires PHP: 8.1
 * Tested up to: 6.9
 */

// Exit if accessed directly
if (!defined('ABSPATH')) exit;

class Thumbnailer
{
    private $options;

    public function __construct()
    {
        // Define constants
        define('THUMBNAILER_VERSION', '1.0.1');
        define('THUMBNAILER_PLUGIN_DIR', plugin_dir_path(__FILE__));
        define('THUMBNAILER_PLUGIN_URL', plugin_dir_url(__FILE__));

        // Initialize the plugin
        add_action('plugins_loaded', array($this, 'init'));
    }

    public function init()
    {
        // Load plugin options
        $this->options = get_option('thumbnailer_options', array(
            'post_ids' => '',
        ));

        // Admin hooks
        if (is_admin()) {
            add_action('admin_menu', array($this, 'add_admin_menu'));
            add_action('admin_init', array($this, 'register_settings'));
        }

        // Frontend hooks
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
    }

    public function add_admin_menu()
    {
        add_options_page(
            'Thumbnailer Settings',
            'Thumbnailer',
            'manage_options',
            'thumbnailer',
            array($this, 'display_settings_page')
        );
    }

    public function register_settings()
    {
        register_setting(
            'thumbnailer_settings',
            'thumbnailer_options',
            array($this, 'sanitize_options')
        );

        add_settings_section(
            'thumbnailer_section',
            'Thumbnailer Settings',
            array($this, 'settings_section_callback'),
            'thumbnailer'
        );

        add_settings_field(
            'post_ids',
            'Post IDs',
            array($this, 'post_ids_field_callback'),
            'thumbnailer',
            'thumbnailer_section'
        );
    }

    public function settings_section_callback()
    {
        echo '<p>Configure which posts should use the thumbnailer functionality.</p>';
    }

    public function post_ids_field_callback()
    {
        $post_ids = isset($this->options['post_ids']) ? $this->options['post_ids'] : '';
        echo '<input type="text" id="post_ids" name="thumbnailer_options[post_ids]" value="' . esc_attr($post_ids) . '" class="regular-text" />';
        echo '<p class="description">Enter comma-separated post IDs where the thumbnailer should be active.</p>';
    }

    public function sanitize_options($input)
    {
        $sanitized_input = array();

        if (isset($input['post_ids'])) {
            // Remove spaces and validate that we only have numbers and commas
            $sanitized_input['post_ids'] = preg_replace('/[^0-9,]/', '', $input['post_ids']);
            // Remove any trailing commas
            $sanitized_input['post_ids'] = rtrim($sanitized_input['post_ids'], ',');
        }

        return $sanitized_input;
    }

    public function display_settings_page()
    {
?>
        <div class="wrap">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
            <form action="options.php" method="post">
                <?php
                settings_fields('thumbnailer_settings');
                do_settings_sections('thumbnailer');
                submit_button();
                ?>
            </form>
        </div>
<?php
    }

    public function enqueue_scripts()
    {
        // Check if we're on a single post page
        if (is_single() || is_page()) {
            global $post;

            // Get the list of post IDs where thumbnailer should be active
            $post_ids = array();
            if (!empty($this->options['post_ids'])) {
                $post_ids = array_map('intval', explode(',', $this->options['post_ids']));
            }

            $script_path = THUMBNAILER_PLUGIN_URL . 'dist/thumbnailer.js';
            $script_version = filemtime(THUMBNAILER_PLUGIN_DIR . 'dist/thumbnailer.js');

            // Check if current post is in the list
            if (in_array($post->ID, $post_ids)) {
                // Enqueue the thumbnailer script
                wp_enqueue_script_module(
                    'thumbnailer',
                    $script_path,
                    array(),
                    $script_version
                );
            }
        }
    }
}

// Initialize the plugin
$thumbnailer = new Thumbnailer();
