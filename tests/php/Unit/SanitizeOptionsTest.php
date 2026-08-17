<?php

declare(strict_types=1);

namespace Avunu\Thumbnailer\Tests\Unit;

use Avunu\Thumbnailer\Plugin;
use Avunu\Thumbnailer\Tests\Support\WordPressTestCase;
use PHPUnit\Framework\Attributes\DataProvider;

final class SanitizeOptionsTest extends WordPressTestCase
{
    private function plugin(): Plugin
    {
        return new Plugin(self::PLUGIN_FILE, self::VERSION);
    }

    /**
     * @return iterable<string, array{mixed, string}>
     */
    public static function inputs(): iterable
    {
        yield 'plain list is preserved' => [['post_ids' => '1,2,3'], '1,2,3'];
        yield 'spaces are stripped' => [['post_ids' => '1, 2 , 3'], '1,2,3'];
        yield 'letters are stripped' => [['post_ids' => '1,abc2,3'], '1,2,3'];
        yield 'trailing comma is trimmed' => [['post_ids' => '1,2,3,'], '1,2,3'];
        yield 'leading comma is trimmed' => [['post_ids' => ',1,2'], '1,2'];
        yield 'repeated commas collapse' => [['post_ids' => '1,,,2'], '1,2'];
        yield 'a lone separator empties' => [['post_ids' => ',,,'], ''];
        yield 'injection attempt is stripped' => [
            ['post_ids' => '1<script>alert(1)</script>'],
            '11',
        ];
        yield 'empty string stays empty' => [['post_ids' => ''], ''];
        yield 'missing key yields empty' => [[], ''];
        yield 'non-array input yields empty' => ['1,2,3', ''];
        yield 'null input yields empty' => [null, ''];
        yield 'nested array value yields empty' => [['post_ids' => ['1', '2']], ''];
    }

    #[DataProvider('inputs')]
    public function testSanitizesToDigitsAndSingleCommas(mixed $input, string $expected): void
    {
        self::assertSame(['post_ids' => $expected], $this->plugin()->sanitizeOptions($input));
    }

    public function testAlwaysReturnsThePostIdsKey(): void
    {
        // register_setting() stores whatever this returns, so a missing key
        // would put a shape into the option that boot() cannot read back.
        self::assertArrayHasKey('post_ids', $this->plugin()->sanitizeOptions(null));
    }

    public function testEnabledPostIdsParsesTheStoredString(): void
    {
        $plugin = $this->withOptions(['post_ids' => '4,15,23']);

        self::assertSame([4, 15, 23], $plugin->enabledPostIds());
    }

    public function testEnabledPostIdsIsEmptyWhenUnset(): void
    {
        self::assertSame([], $this->bootedPlugin()->enabledPostIds());
    }

    public function testEnabledPostIdsDropsZeroes(): void
    {
        // intval('') is 0, and 0 is never a valid post ID — letting it through
        // would enable the script on any request where get_post() returned a
        // zero-ID placeholder.
        $plugin = $this->withOptions(['post_ids' => '0,7']);

        self::assertSame([7], $plugin->enabledPostIds());
    }
}
