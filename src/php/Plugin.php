<?php

declare(strict_types=1);

namespace Avunu\Thumbnailer;

defined('ABSPATH') || exit;

/**
 * Loads the Thumbnailer browser library on an explicitly configured set of
 * posts and pages.
 *
 * The plugin file path and version arrive as constructor arguments rather than
 * being read from constants, so the class can be instantiated directly in
 * tests without the WordPress bootstrap having run.
 */
final class Plugin
{
    private const OPTION_NAME = 'thumbnailer_options';
    private const SETTINGS_GROUP = 'thumbnailer_settings';
    private const MENU_SLUG = 'thumbnailer';
    private const SECTION_ID = 'thumbnailer_section';
    private const SCRIPT_HANDLE = 'thumbnailer';

    /** Comma-separated post IDs, exactly as stored. */
    private string $postIds = '';

    public function __construct(
        private readonly string $pluginFile,
        private readonly string $version,
    ) {
    }

    public function register(): void
    {
        add_action('plugins_loaded', [$this, 'boot']);
    }

    public function boot(): void
    {
        $stored = get_option(self::OPTION_NAME, []);
        $this->postIds = is_array($stored) && isset($stored['post_ids']) && is_scalar($stored['post_ids'])
            ? (string) $stored['post_ids']
            : '';

        if (is_admin()) {
            add_action('admin_menu', [$this, 'addAdminMenu']);
            add_action('admin_init', [$this, 'registerSettings']);
        }

        add_action('wp_enqueue_scripts', [$this, 'enqueueScripts']);
    }

    // ── Admin ────────────────────────────────────────────────────────────────

    public function addAdminMenu(): void
    {
        add_options_page(
            __('Thumbnailer Settings', 'thumbnailer'),
            __('Thumbnailer', 'thumbnailer'),
            'manage_options',
            self::MENU_SLUG,
            [$this, 'displaySettingsPage']
        );
    }

    public function registerSettings(): void
    {
        register_setting(
            self::SETTINGS_GROUP,
            self::OPTION_NAME,
            [
                'type' => 'array',
                'sanitize_callback' => [$this, 'sanitizeOptions'],
                'default' => ['post_ids' => ''],
            ]
        );

        add_settings_section(
            self::SECTION_ID,
            __('Thumbnailer Settings', 'thumbnailer'),
            [$this, 'settingsSectionCallback'],
            self::MENU_SLUG
        );

        add_settings_field(
            'post_ids',
            __('Post IDs', 'thumbnailer'),
            [$this, 'postIdsFieldCallback'],
            self::MENU_SLUG,
            self::SECTION_ID
        );
    }

    public function settingsSectionCallback(): void
    {
        echo '<p>' . esc_html__(
            'Configure which posts should use the thumbnailer functionality.',
            'thumbnailer'
        ) . '</p>';
    }

    public function postIdsFieldCallback(): void
    {
        printf(
            '<input type="text" id="post_ids" name="%s[post_ids]" value="%s" class="regular-text" />',
            esc_attr(self::OPTION_NAME),
            esc_attr($this->postIds)
        );
        echo '<p class="description">' . esc_html__(
            'Enter comma-separated post IDs where the thumbnailer should be active.',
            'thumbnailer'
        ) . '</p>';
    }

    public function displaySettingsPage(): void
    {
        ?>
        <div class="wrap">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
            <form action="options.php" method="post">
                <?php
                settings_fields(self::SETTINGS_GROUP);
                do_settings_sections(self::MENU_SLUG);
                submit_button();
                ?>
            </form>
        </div>
        <?php
    }

    /**
     * @return array{post_ids: string}
     */
    public function sanitizeOptions(mixed $input): array
    {
        if (!is_array($input) || !isset($input['post_ids']) || !is_scalar($input['post_ids'])) {
            return ['post_ids' => ''];
        }

        // Digits and separators only, then normalise: collapse runs of commas
        // ("1,,2") and drop leading/trailing ones (",1,").
        $postIds = (string) preg_replace('/[^0-9,]/', '', (string) $input['post_ids']);
        $postIds = (string) preg_replace('/,+/', ',', $postIds);

        return ['post_ids' => trim($postIds, ',')];
    }

    // ── Frontend ─────────────────────────────────────────────────────────────

    /**
     * @return list<int>
     */
    public function enabledPostIds(): array
    {
        if ($this->postIds === '') {
            return [];
        }

        // array_filter drops the zeroes intval() yields for empty segments; 0 is
        // never a valid post ID anyway.
        return array_values(array_filter(array_map('intval', explode(',', $this->postIds))));
    }

    public function enqueueScripts(): void
    {
        if (!is_single() && !is_page()) {
            return;
        }

        $post = get_post();
        if (!$post instanceof \WP_Post) {
            return;
        }

        if (!in_array((int) $post->ID, $this->enabledPostIds(), true)) {
            return;
        }

        // Cache-bust on the plugin version, not filemtime(): this file is read
        // from the Nix store in a Nix-built install, where every mtime is
        // normalised to the epoch and filemtime() returns a constant.
        wp_enqueue_script_module(
            self::SCRIPT_HANDLE,
            plugin_dir_url($this->pluginFile) . 'dist/thumbnailer.js',
            [],
            $this->version
        );
    }
}
