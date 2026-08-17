<?php

declare(strict_types=1);

namespace Avunu\Thumbnailer\Tests\Unit;

use Avunu\Thumbnailer\Tests\Support\WordPressTestCase;

final class SettingsTest extends WordPressTestCase
{
    public function testRegistersAdminHooksInTheAdmin(): void
    {
        $this->wp->isAdmin = true;
        $this->bootedPlugin();

        self::assertTrue($this->wp->hasAction('admin_menu'));
        self::assertTrue($this->wp->hasAction('admin_init'));
    }

    public function testAddsAnOptionsPageBehindManageOptions(): void
    {
        $this->wp->isAdmin = true;
        $plugin = $this->bootedPlugin();

        $plugin->addAdminMenu();

        self::assertCount(1, $this->wp->optionsPages);
        self::assertSame('thumbnailer', $this->wp->optionsPages[0]['slug']);
        self::assertSame('manage_options', $this->wp->optionsPages[0]['capability']);
    }

    public function testRegistersTheSettingWithItsSanitizer(): void
    {
        $plugin = $this->bootedPlugin();

        $plugin->registerSettings();

        self::assertArrayHasKey('thumbnailer_options', $this->wp->registeredSettings);
        $setting = $this->wp->registeredSettings['thumbnailer_options'];

        self::assertSame('thumbnailer_settings', $setting['group']);
        // Without a sanitize_callback WordPress stores the raw POST value, so
        // the digits-and-commas guarantee the frontend relies on would be gone.
        self::assertSame([$plugin, 'sanitizeOptions'], $setting['args']['sanitize_callback']);
    }

    public function testRegistersTheSectionAndFieldOnItsOwnPage(): void
    {
        $plugin = $this->bootedPlugin();

        $plugin->registerSettings();

        self::assertCount(1, $this->wp->settingsSections);
        self::assertSame('thumbnailer', $this->wp->settingsSections[0]['page']);

        self::assertCount(1, $this->wp->settingsFields);
        self::assertSame('post_ids', $this->wp->settingsFields[0]['id']);
        self::assertSame('thumbnailer_section', $this->wp->settingsFields[0]['section']);
    }

    public function testFieldRendersTheStoredValueEscaped(): void
    {
        $plugin = $this->withOptions(['post_ids' => '1,2']);

        ob_start();
        $plugin->postIdsFieldCallback();
        $html = (string) ob_get_clean();

        self::assertStringContainsString('name="thumbnailer_options[post_ids]"', $html);
        self::assertStringContainsString('value="1,2"', $html);
    }

    public function testFieldEscapesAValueThatBypassedTheSanitizer(): void
    {
        // Options can be written directly (WP-CLI, a migration, another plugin),
        // so the render path cannot assume sanitizeOptions() ever ran.
        $plugin = $this->withOptions(['post_ids' => '"><script>alert(1)</script>']);

        ob_start();
        $plugin->postIdsFieldCallback();
        $html = (string) ob_get_clean();

        self::assertStringNotContainsString('<script>', $html);
        self::assertStringContainsString('&lt;script&gt;', $html);
    }
}
