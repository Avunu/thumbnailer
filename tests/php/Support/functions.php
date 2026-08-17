<?php

declare(strict_types=1);

/**
 * An in-memory stand-in for the slice of the WordPress API the plugin touches.
 *
 * Deliberately global, like the real thing. State lives in WpState so a test
 * can arrange it (`$state->isSingle = true`) and then assert on the result
 * (`$state->enqueuedModules`). Nothing here talks to a database, a filesystem
 * or a network, so the whole PHP suite runs inside the Nix sandbox.
 */

use Avunu\Thumbnailer\Tests\Support\WpState;

if (!defined('ABSPATH')) {
    define('ABSPATH', __DIR__ . '/');
}

if (!class_exists('WP_Post')) {
    /**
     * Only the one property the plugin reads.
     */
    class WP_Post
    {
        public function __construct(public int $ID)
        {
        }
    }
}

if (!function_exists('add_action')) {
    function add_action(
        string $hook,
        callable $callback,
        int $priority = 10,
        int $acceptedArgs = 1
    ): bool {
        WpState::instance()->actions[$hook][] = $callback;

        return true;
    }
}

if (!function_exists('get_option')) {
    function get_option(string $option, mixed $default = false): mixed
    {
        return WpState::instance()->options[$option] ?? $default;
    }
}

if (!function_exists('is_admin')) {
    function is_admin(): bool
    {
        return WpState::instance()->isAdmin;
    }
}

if (!function_exists('is_single')) {
    function is_single(): bool
    {
        return WpState::instance()->isSingle;
    }
}

if (!function_exists('is_page')) {
    function is_page(): bool
    {
        return WpState::instance()->isPage;
    }
}

if (!function_exists('get_post')) {
    function get_post(): ?WP_Post
    {
        return WpState::instance()->post;
    }
}

if (!function_exists('wp_enqueue_script_module')) {
    /**
     * @param array<int, string> $deps
     */
    function wp_enqueue_script_module(
        string $handle,
        string $src = '',
        array $deps = [],
        mixed $version = false
    ): void {
        WpState::instance()->enqueuedModules[] = [
            'handle' => $handle,
            'src' => $src,
            'deps' => $deps,
            'version' => $version,
        ];
    }
}

if (!function_exists('plugin_dir_path')) {
    function plugin_dir_path(string $file): string
    {
        return rtrim(dirname($file), '/') . '/';
    }
}

if (!function_exists('plugin_dir_url')) {
    function plugin_dir_url(string $file): string
    {
        return 'https://example.test/wp-content/plugins/' . basename(dirname($file)) . '/';
    }
}

if (!function_exists('add_options_page')) {
    function add_options_page(
        string $pageTitle,
        string $menuTitle,
        string $capability,
        string $menuSlug,
        ?callable $callback = null
    ): string {
        WpState::instance()->optionsPages[] = [
            'title' => $pageTitle,
            'menu' => $menuTitle,
            'capability' => $capability,
            'slug' => $menuSlug,
        ];

        return 'settings_page_' . $menuSlug;
    }
}

if (!function_exists('register_setting')) {
    /**
     * @param array<string, mixed> $args
     */
    function register_setting(string $group, string $option, array $args = []): void
    {
        WpState::instance()->registeredSettings[$option] = [
            'group' => $group,
            'args' => $args,
        ];
    }
}

if (!function_exists('add_settings_section')) {
    function add_settings_section(
        string $id,
        string $title,
        ?callable $callback,
        string $page
    ): void {
        WpState::instance()->settingsSections[] = [
            'id' => $id,
            'title' => $title,
            'page' => $page,
        ];
    }
}

if (!function_exists('add_settings_field')) {
    function add_settings_field(
        string $id,
        string $title,
        ?callable $callback,
        string $page,
        string $section = 'default'
    ): void {
        WpState::instance()->settingsFields[] = [
            'id' => $id,
            'title' => $title,
            'page' => $page,
            'section' => $section,
        ];
    }
}

if (!function_exists('esc_attr')) {
    function esc_attr(string $text): string
    {
        return htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
    }
}

if (!function_exists('esc_html')) {
    function esc_html(string $text): string
    {
        return htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
    }
}

if (!function_exists('__')) {
    function __(string $text, string $domain = 'default'): string
    {
        return $text;
    }
}

if (!function_exists('esc_html__')) {
    function esc_html__(string $text, string $domain = 'default'): string
    {
        return esc_html($text);
    }
}

if (!function_exists('get_admin_page_title')) {
    function get_admin_page_title(): string
    {
        return 'Thumbnailer Settings';
    }
}

if (!function_exists('settings_fields')) {
    function settings_fields(string $group): void
    {
        echo '<input type="hidden" name="option_page" value="' . esc_attr($group) . '" />';
    }
}

if (!function_exists('do_settings_sections')) {
    function do_settings_sections(string $page): void
    {
        echo '<!-- sections: ' . esc_html($page) . ' -->';
    }
}

if (!function_exists('submit_button')) {
    function submit_button(): void
    {
        echo '<button type="submit">Save Changes</button>';
    }
}
